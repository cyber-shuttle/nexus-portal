const DAY_MS = 24 * 60 * 60 * 1000;

// Structural usage point shape — keeps analytics independent of the `usage`
// feature module so cross-feature isolation greps stay zero (spec §5.2).
export type UsagePoint = {
  compute_allocation_id: string;
  compute_allocation_resource_id?: string;
  used_su_amount: number;
  last_updated: string;
};

export type DailyResourceBucket = {
  date: string;
} & Record<string, number | string>;

// Buckets usages into day x resource rows for `StackedAreaUsage`. When the
// usage row lacks a resource id (gap noted in docs/backend-contracts/usage.md),
// the allocation id is used as the series key so the chart still renders a
// meaningful stack.
export function bucketUsageByDayResource(
  usages: UsagePoint[],
  from: Date,
  to: Date,
): { rows: DailyResourceBucket[]; seriesKeys: string[] } {
  const fromDay = startOfUtcDay(from);
  const toDay = startOfUtcDay(to);
  const dayCount = Math.max(1, Math.round((toDay.getTime() - fromDay.getTime()) / DAY_MS) + 1);
  const seriesSet = new Set<string>();
  const byDate = new Map<string, Map<string, number>>();
  for (let i = 0; i < dayCount; i += 1) {
    const date = new Date(fromDay.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    byDate.set(date, new Map());
  }
  for (const u of usages) {
    const t = Date.parse(u.last_updated);
    if (Number.isNaN(t)) continue;
    if (t < fromDay.getTime() || t > to.getTime()) continue;
    const date = new Date(t).toISOString().slice(0, 10);
    const dayBucket = byDate.get(date);
    if (!dayBucket) continue;
    const seriesKey = u.compute_allocation_resource_id || u.compute_allocation_id;
    seriesSet.add(seriesKey);
    dayBucket.set(seriesKey, (dayBucket.get(seriesKey) ?? 0) + u.used_su_amount);
  }
  const seriesKeys = Array.from(seriesSet).sort();
  const rows: DailyResourceBucket[] = Array.from(byDate.entries())
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, dayBucket]) => {
      const row: DailyResourceBucket = { date };
      for (const key of seriesKeys) row[key] = dayBucket.get(key) ?? 0;
      return row;
    });
  return { rows, seriesKeys };
}

export type ResourceMixSlice = { resource_id: string; total: number };

// Rolls a usage list up to one slice per resource for the donut chart.
export function resourceMix(usages: UsagePoint[]): ResourceMixSlice[] {
  const totals = new Map<string, number>();
  for (const u of usages) {
    const key = u.compute_allocation_resource_id || u.compute_allocation_id;
    totals.set(key, (totals.get(key) ?? 0) + u.used_su_amount);
  }
  return Array.from(totals.entries())
    .map(([resource_id, total]) => ({ resource_id, total }))
    .sort((a, b) => b.total - a.total);
}

export type ResearcherKpis = {
  usedSUs: number;
  burnRatePerDay: number;
  daysLeft: number | null;
  usedSparkline: number[];
};

// Computes Used / Burn rate / Days left from a flat usage stream over the
// active date range plus a remaining-balance figure. Burn = used / elapsed
// days in window; spec §6.1 KPI strip definition.
export function researcherKpisFromUsage(
  usages: UsagePoint[],
  totalAllocated: number,
  range: { from: Date; to: Date },
  daysLeftHint: number | null,
): ResearcherKpis {
  const elapsedDays = Math.max(
    1,
    Math.round((range.to.getTime() - range.from.getTime()) / DAY_MS),
  );
  let used = 0;
  const perDay = new Map<string, number>();
  for (const u of usages) {
    const t = Date.parse(u.last_updated);
    if (Number.isNaN(t) || t < range.from.getTime() || t > range.to.getTime()) continue;
    used += u.used_su_amount;
    const date = new Date(t).toISOString().slice(0, 10);
    perDay.set(date, (perDay.get(date) ?? 0) + u.used_su_amount);
  }
  const sparkline: number[] = [];
  for (let i = 0; i < elapsedDays; i += 1) {
    const day = new Date(range.from.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    sparkline.push(perDay.get(day) ?? 0);
  }
  const burnRatePerDay = elapsedDays > 0 ? used / elapsedDays : 0;
  let daysLeft = daysLeftHint;
  if (daysLeft === null) {
    const remaining = Math.max(0, totalAllocated - used);
    daysLeft = burnRatePerDay > 0 ? Math.floor(remaining / burnRatePerDay) : null;
  }
  return { usedSUs: used, burnRatePerDay, daysLeft, usedSparkline: sparkline };
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0),
  );
}

// --- PI aggregations -------------------------------------------------------

export type PiProjectRollup = {
  projectId: string;
  projectName: string;
  used: number;
  allocated: number;
  forecastExhaust: Date | null;
  endDate: Date | null;
  atRisk: boolean;
  pendingChangeRequests: number;
  firstAllocationId: string | null;
};

// `projectsAtRisk` flags projects whose forecast exhaust falls more than
// `riskBufferDays` (default 7 per spec §6.2 KPI #4) before the latest award
// end across the project's allocations.
const RISK_BUFFER_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export function isProjectAtRisk(
  forecastExhaust: Date | null,
  endDate: Date | null,
  bufferDays: number = RISK_BUFFER_DAYS,
): boolean {
  if (!forecastExhaust || !endDate) return false;
  return forecastExhaust.getTime() < endDate.getTime() - bufferDays * DAY;
}

export function projectsAtRiskCount(rollups: PiProjectRollup[]): number {
  return rollups.reduce((acc, r) => (r.atRisk ? acc + 1 : acc), 0);
}

export type MemberContribution = {
  user_id: string;
  total: number;
};

// `topMembers` rolls per-membership totals up to one row per user, sorts desc,
// and folds the tail beyond `n` into a single "Other" bucket so the bar chart
// stays readable for PIs with many members across projects.
export function topMembers(
  contributions: MemberContribution[],
  n = 10,
  otherLabel = "Other",
): MemberContribution[] {
  const byUser = new Map<string, number>();
  for (const c of contributions) {
    byUser.set(c.user_id, (byUser.get(c.user_id) ?? 0) + c.total);
  }
  const merged: MemberContribution[] = Array.from(byUser.entries())
    .map(([user_id, total]) => ({ user_id, total }))
    .sort((a, b) => b.total - a.total);
  if (merged.length <= n) return merged;
  const head = merged.slice(0, n);
  const tail = merged.slice(n);
  const other = tail.reduce((acc, c) => acc + c.total, 0);
  return [...head, { user_id: otherLabel, total: other }];
}

// `projectForecast` returns the earliest allocation exhaust across a project's
// allocations; that's the limiting factor for "this project will run out".
export function projectForecast(
  rollups: Array<{ forecastExhaust: Date | null }>,
): Date | null {
  let earliest: number | null = null;
  for (const r of rollups) {
    if (!r.forecastExhaust) continue;
    const t = r.forecastExhaust.getTime();
    if (earliest === null || t < earliest) earliest = t;
  }
  return earliest === null ? null : new Date(earliest);
}
