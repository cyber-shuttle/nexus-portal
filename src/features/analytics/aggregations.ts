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
