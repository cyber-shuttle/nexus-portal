import { buildAuditTimeline, type AuditEvent } from "@shared/api/audit-orchestrator";
import type {
  ComputeAllocation,
  ComputeAllocationChangeRequest,
  ComputeAllocationDiff,
} from "@shared/api/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ResourceBreakdown = {
  resource_id: string;
  su: number;
};

export type AllocationClassification = {
  active: ComputeAllocation[];
  expiring_soon: ComputeAllocation[];
  recently_active: ComputeAllocation[];
};

export type Usage30d = {
  last_30d_su: number;
  last_30d_breakdown: ResourceBreakdown[];
};

export type AggregatedSummary = {
  allocations: AllocationClassification;
  usage: Usage30d;
  pending_change_requests: ComputeAllocationChangeRequest[];
  recent_activity: AuditEvent[];
};

export function classifyAllocations(
  allocations: ComputeAllocation[],
  usageByAllocation: Map<string, Array<{ timestamp: string }>>,
  now: number = Date.now(),
): AllocationClassification {
  const active: ComputeAllocation[] = [];
  const expiring_soon: ComputeAllocation[] = [];
  const recently_active: ComputeAllocation[] = [];

  const expiryCutoff = now + 30 * DAY_MS;
  const activityCutoff = now - 7 * DAY_MS;

  for (const allocation of allocations) {
    if (allocation.status !== "ACTIVE") continue;
    active.push(allocation);
    const endMs = new Date(allocation.end_time).getTime();
    if (!Number.isNaN(endMs) && endMs <= expiryCutoff && endMs >= now) {
      expiring_soon.push(allocation);
    }
    const usages = usageByAllocation.get(allocation.id) ?? [];
    const hasRecent = usages.some((u) => {
      const t = new Date(u.timestamp).getTime();
      return !Number.isNaN(t) && t >= activityCutoff;
    });
    if (hasRecent) recently_active.push(allocation);
  }

  return { active, expiring_soon, recently_active };
}

export function computeUsage30d(
  usages: Array<{
    compute_allocation_resource_id: string;
    used_su_amount: number;
    last_updated: string;
  }>,
  now: number = Date.now(),
): Usage30d {
  const cutoff = now - 30 * DAY_MS;
  const breakdownMap = new Map<string, number>();
  let total = 0;
  for (const u of usages) {
    const t = new Date(u.last_updated).getTime();
    if (Number.isNaN(t) || t < cutoff) continue;
    total += u.used_su_amount;
    const prev = breakdownMap.get(u.compute_allocation_resource_id) ?? 0;
    breakdownMap.set(u.compute_allocation_resource_id, prev + u.used_su_amount);
  }
  const last_30d_breakdown: ResourceBreakdown[] = Array.from(breakdownMap.entries())
    .map(([resource_id, su]) => ({ resource_id, su }))
    .sort((a, b) => b.su - a.su);
  return { last_30d_su: total, last_30d_breakdown };
}

export function pendingChangeRequests(
  requests: ComputeAllocationChangeRequest[],
): ComputeAllocationChangeRequest[] {
  return requests.filter((r) => r.change_status === "PENDING");
}

export type RecentActivityInput = {
  diffs: ComputeAllocationDiff[];
  changeRequests: ComputeAllocationChangeRequest[];
};

export function buildRecentActivity(input: RecentActivityInput, limit = 20) {
  const timeline = buildAuditTimeline(
    input.diffs,
    input.changeRequests.map((r) => ({ request: r, events: [] })),
  );
  return timeline.slice(0, limit);
}

export type AggregateHomeInput = {
  allocations: ComputeAllocation[];
  usagesByAllocation: Map<
    string,
    Array<{
      compute_allocation_id: string;
      compute_allocation_resource_id: string;
      used_su_amount: number;
      last_updated: string;
    }>
  >;
  diffs: ComputeAllocationDiff[];
  changeRequests: ComputeAllocationChangeRequest[];
};

export function aggregateHomeSummary(
  input: AggregateHomeInput,
  now: number = Date.now(),
): AggregatedSummary {
  const usageByAllocationTimestamps = new Map<string, Array<{ timestamp: string }>>();
  const flatUsages: Array<{
    compute_allocation_resource_id: string;
    used_su_amount: number;
    last_updated: string;
  }> = [];
  for (const [allocId, usages] of input.usagesByAllocation.entries()) {
    usageByAllocationTimestamps.set(
      allocId,
      usages.map((u) => ({ timestamp: u.last_updated })),
    );
    flatUsages.push(...usages);
  }
  return {
    allocations: classifyAllocations(input.allocations, usageByAllocationTimestamps, now),
    usage: computeUsage30d(flatUsages, now),
    pending_change_requests: pendingChangeRequests(input.changeRequests),
    recent_activity: buildRecentActivity(
      { diffs: input.diffs, changeRequests: input.changeRequests },
      20,
    ),
  };
}

// --- Analytics extensions (spec §5.2) -------------------------------------

export type Allocation = {
  initial_su_amount: number;
  start_time: string;
  end_time: string;
};

export type UsagePoint = {
  used_su_amount: number;
  last_updated: string;
};

export type PaceStatus = "on-pace" | "under" | "over";

export type PaceResult = {
  burn: number;
  expected: number;
  status: PaceStatus;
};

// `pace` compares used/allocated against elapsed/period_total — within ±10% of
// the expected pro-rata burn we call it on-pace, otherwise over (faster) / under.
export function pace(
  allocation: Allocation,
  usages: UsagePoint[],
  now: number = Date.now(),
): PaceResult {
  const totalUsed = usages.reduce((acc, u) => acc + u.used_su_amount, 0);
  const allocated = allocation.initial_su_amount;
  const startMs = new Date(allocation.start_time).getTime();
  const endMs = new Date(allocation.end_time).getTime();
  const periodTotal = Math.max(0, endMs - startMs);
  const elapsed = Math.min(Math.max(0, now - startMs), periodTotal);
  const burn = allocated > 0 ? totalUsed / allocated : 0;
  const expected = periodTotal > 0 ? elapsed / periodTotal : 0;
  const tolerance = 0.1;
  let status: PaceStatus;
  if (Math.abs(burn - expected) <= tolerance) status = "on-pace";
  else if (burn > expected) status = "over";
  else status = "under";
  return { burn, expected, status };
}

export type ForecastMethod = "rolling-7d" | "insufficient-data";

export type ForecastResult = {
  exhaustDate: Date | null;
  daysRemaining: number | null;
  method: ForecastMethod;
};

// `forecast` projects exhaust via a rolling-7d burn slope over `last_updated` points.
// Needs a 7-day window of distinct daily data; otherwise returns `insufficient-data`
// so callers can render a richer empty state than bare nulls.
export function forecast(
  usages: UsagePoint[],
  allocation: Allocation,
  asOf: number = Date.now(),
): ForecastResult {
  const sevenDaysMs = 7 * DAY_MS;
  const windowStart = asOf - sevenDaysMs;
  const inWindow = usages.filter((u) => {
    const t = new Date(u.last_updated).getTime();
    return !Number.isNaN(t) && t >= windowStart && t <= asOf;
  });
  const distinctDays = new Set(
    inWindow.map((u) => new Date(u.last_updated).toISOString().slice(0, 10)),
  );
  if (distinctDays.size < 7) {
    return { exhaustDate: null, daysRemaining: null, method: "insufficient-data" };
  }
  const totalUsedInWindow = inWindow.reduce((acc, u) => acc + u.used_su_amount, 0);
  const slopePerDay = totalUsedInWindow / 7;
  if (slopePerDay <= 0) {
    return { exhaustDate: null, daysRemaining: null, method: "insufficient-data" };
  }
  const totalUsedAll = usages.reduce((acc, u) => acc + u.used_su_amount, 0);
  const remaining = Math.max(0, allocation.initial_su_amount - totalUsedAll);
  const daysRemaining = remaining / slopePerDay;
  const exhaustDate = new Date(asOf + daysRemaining * DAY_MS);
  return { exhaustDate, daysRemaining, method: "rolling-7d" };
}

export type TopNReducer<T> = (acc: T, item: T) => T;

// `topN` returns the first N items by `by(item)` desc plus an aggregated "Other"
// row built from the remainder via the supplied reducer.
export function topN<T>(
  items: T[],
  by: (item: T) => number,
  n = 10,
  otherLabel = "Other",
  reducer?: TopNReducer<T>,
  makeOther?: (rest: T[], label: string) => T,
): T[] {
  if (items.length <= n) return [...items];
  const sorted = [...items].sort((a, b) => by(b) - by(a));
  const head = sorted.slice(0, n);
  const tail = sorted.slice(n);
  if (tail.length === 0) return head;
  if (makeOther) return [...head, makeOther(tail, otherLabel)];
  if (!reducer) return head;
  const first = tail[0];
  if (first === undefined) return head;
  const combined = tail.slice(1).reduce<T>((acc, item) => reducer(acc, item), first);
  return [...head, combined];
}

export type ComplianceBand = "ok" | "warn" | "hot" | "empty";

// Bands match `UsageBar` thresholds: ≥90% hot, ≥75% warn, ≥1 ok, else empty.
export function bandForUsageRatio(ratio: number): ComplianceBand {
  if (!Number.isFinite(ratio) || ratio < 0.01) return "empty";
  if (ratio >= 0.9) return "hot";
  if (ratio >= 0.75) return "warn";
  return "ok";
}

