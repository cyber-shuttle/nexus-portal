import { buildAuditTimeline } from "@shared/api/audit-orchestrator";
import type {
  ComputeAllocation,
  ComputeAllocationChangeRequest,
  ComputeAllocationDiff,
} from "@shared/api/domain";
import type { HomeAllocations, HomeSummary, HomeUsage, ResourceBreakdown } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function classifyAllocations(
  allocations: ComputeAllocation[],
  usageByAllocation: Map<string, Array<{ timestamp: string }>>,
  now: number = Date.now(),
): HomeAllocations {
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
): HomeUsage {
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
): HomeSummary {
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
