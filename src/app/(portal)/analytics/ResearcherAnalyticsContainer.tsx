"use client";

import { getAllocation } from "@features/allocations/api";
import { allocationKeys } from "@features/allocations/queries";
import {
  type ResearcherForecastBundle,
  type ResearcherKpiBundle,
  ResearcherAnalytics,
} from "@features/analytics/components/ResearcherAnalytics";
import {
  bucketUsageByDayResource,
  researcherKpisFromUsage,
  resourceMix,
} from "@features/analytics/aggregations";
import { useJobs, useQueueWaitTimes } from "@features/analytics/queries";
import { useMembershipsForUser } from "@features/members/queries";
import { getAllocationUsages } from "@features/usage/api";
import { usageKeys } from "@features/usage/queries";
import { type ForecastResult, forecast } from "@shared/api/aggregator";
import { useAbility } from "@shared/casl/AbilityProvider";
import type { DateRangeValue } from "@/shared/ui/DateRangePicker";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { useUrlGroupBy } from "@/shared/hooks/useUrlGroupBy";
import { useUrlRange } from "@/shared/hooks/useUrlRange";
import { subject } from "@casl/ability";
import { useQueries } from "@tanstack/react-query";
import * as React from "react";

const ANALYTICS_USAGE_LIMIT = 2000;
const RECENT_JOBS_LIMIT = 25;

export type ResearcherAnalyticsContainerProps = {
  userId: string;
};

// Route-level fan-out per spec §5.2: this is the only place where the
// allocation / usage / jobs / wait-time queries are composed. Feature
// components consume the resulting bundles via props.
export function ResearcherAnalyticsContainer({ userId }: ResearcherAnalyticsContainerProps) {
  const ability = useAbility();
  const { range, setRange } = useUrlRange();
  // Multi-chip GroupBy slots (A1 carry-over 0b): slot 0 = resource, slot 1 = project.
  const { groupBy, setGroupBy } = useUrlGroupBy();
  const groupByResource = groupBy[0] ?? "resource";
  const groupByProject = groupBy[1] ?? "all";

  const membershipsQuery = useMembershipsForUser(userId);
  const memberships = membershipsQuery.data ?? [];
  const allocationIds = React.useMemo(
    () => Array.from(new Set(memberships.map((m) => m.compute_allocation_id))),
    [memberships],
  );

  const allocationQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: allocationKeys.detail(id),
      queryFn: () => getAllocation(id),
      enabled: true,
    })),
  });

  const usageParams = {
    limit: ANALYTICS_USAGE_LIMIT,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  };
  const usageQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: usageKeys.list(id, usageParams),
      queryFn: () => getAllocationUsages(id, usageParams),
      enabled: true,
    })),
  });

  const jobsQuery = useJobs({
    user_id: userId,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    limit: RECENT_JOBS_LIMIT,
  });

  const waitTimeQuery = useQueueWaitTimes({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    group_by: "queue",
  });

  const allocations = React.useMemo(
    () =>
      allocationQueries
        .map((q) => q.data)
        .filter((a): a is NonNullable<typeof a> => Boolean(a)),
    [allocationQueries],
  );

  const flatUsages = React.useMemo(
    () => usageQueries.flatMap((q) => q.data ?? []),
    [usageQueries],
  );

  const isLoading =
    membershipsQuery.isLoading ||
    allocationQueries.some((q) => q.isLoading) ||
    usageQueries.some((q) => q.isLoading) ||
    jobsQuery.isLoading ||
    waitTimeQuery.isLoading;

  const error =
    (membershipsQuery.error as Error | null) ??
    (allocationQueries.find((q) => q.error)?.error as Error | undefined) ??
    (usageQueries.find((q) => q.error)?.error as Error | undefined) ??
    (jobsQuery.error as Error | null) ??
    (waitTimeQuery.error as Error | null) ??
    null;

  // Auth gate: the resolver picks researcher when no admin/PI flags exist, so
  // the worst case here is a researcher who lacks self-read (shouldn't happen
  // for an authed user, but the spec requires defense-in-depth).
  const canRead = ability.can("read", subject("AnalyticsResearcher", { userId }));
  if (!canRead) {
    return <ErrorState heading="Not permitted" />;
  }

  if (isLoading) return <CenteredSpinner label="Loading analytics" />;
  if (error) return <ErrorState message={error.message} />;

  const totalAllocated = allocations.reduce((acc, a) => acc + a.initial_su_amount, 0);
  const primary = pickPrimaryAllocation(allocations, flatUsages);
  const primaryUsages = primary
    ? flatUsages.filter((u) => u.compute_allocation_id === primary.id)
    : [];
  const primaryForecast: ForecastResult = primary
    ? forecast(
        primaryUsages.map((u) => ({
          used_su_amount: u.used_su_amount,
          last_updated: u.last_updated,
        })),
        primary,
        range.to.getTime(),
      )
    : { exhaustDate: null, daysRemaining: null, method: "insufficient-data" };

  const usedPrimary = primaryUsages.reduce((acc, u) => acc + u.used_su_amount, 0);
  const burnRate = computeBurnRatePerDay(primaryUsages, range);
  const projectedPrimary = projectForecastUsed(usedPrimary, primary?.end_time, burnRate);
  const recentJobs = jobsQuery.data ?? [];
  const waitTimes = waitTimeQuery.data ?? [];

  const kpis: ResearcherKpiBundle = {
    ...researcherKpisFromUsage(
      flatUsages,
      totalAllocated,
      range,
      primaryForecast.daysRemaining !== null
        ? Math.max(0, Math.floor(primaryForecast.daysRemaining))
        : null,
    ),
    jobsRun: recentJobs.length,
    avgWaitSeconds: averageWaitSeconds(recentJobs),
  };

  const daily = bucketUsageByDayResource(flatUsages, range.from, range.to);
  const mix = resourceMix(flatUsages);

  const dateRangeValue: DateRangeValue = {
    from: range.from,
    to: range.to,
    preset: range.preset,
  };

  const forecastBundle: ResearcherForecastBundle = {
    used: usedPrimary,
    projected: projectedPrimary,
    capacity: primary?.initial_su_amount ?? 0,
    forecast: primaryForecast,
    endDate: primary?.end_time ?? null,
    primaryAllocationId: primary?.id ?? null,
    primaryAllocationName: primary?.name ?? null,
  };

  const syncedAt = newestUpdate(flatUsages) ?? new Date();

  return (
    <ResearcherAnalytics
      syncedAt={syncedAt}
      onRefetch={() => {
        for (const q of usageQueries) q.refetch();
        jobsQuery.refetch();
        waitTimeQuery.refetch();
      }}
      range={dateRangeValue}
      onRangeChange={(next) => setRange({ from: next.from, to: next.to, preset: next.preset ?? "custom" })}
      groupByResource={groupByResource}
      onGroupByResourceChange={(next) => setGroupBy([next, groupByProject])}
      groupByProject={groupByProject}
      onGroupByProjectChange={(next) => setGroupBy([groupByResource, next])}
      kpis={kpis}
      forecastBundle={forecastBundle}
      daily={daily}
      waitTimes={waitTimes}
      resourceMix={mix}
      recentJobs={recentJobs}
    />
  );
}

type AllocationLike = {
  id: string;
  name: string;
  status: string;
  initial_su_amount: number;
  start_time: string;
  end_time: string;
};

function pickPrimaryAllocation(
  allocations: AllocationLike[],
  _usages: unknown[],
): AllocationLike | undefined {
  const active = allocations.filter((a) => a.status === "ACTIVE");
  const pool = active.length > 0 ? active : allocations;
  return pool.slice().sort((a, b) => b.initial_su_amount - a.initial_su_amount)[0];
}

function computeBurnRatePerDay(
  usages: Array<{ used_su_amount: number; last_updated: string }>,
  range: { from: Date; to: Date },
): number {
  const DAY = 24 * 60 * 60 * 1000;
  const days = Math.max(1, Math.round((range.to.getTime() - range.from.getTime()) / DAY));
  const total = usages.reduce((acc, u) => {
    const t = Date.parse(u.last_updated);
    if (Number.isNaN(t) || t < range.from.getTime() || t > range.to.getTime()) return acc;
    return acc + u.used_su_amount;
  }, 0);
  return total / days;
}

function projectForecastUsed(
  used: number,
  endIso: string | undefined,
  burnRatePerDay: number,
): number {
  if (!endIso) return used;
  const remainingDays = Math.max(
    0,
    Math.round((Date.parse(endIso) - Date.now()) / (24 * 60 * 60 * 1000)),
  );
  return used + burnRatePerDay * remainingDays;
}

function averageWaitSeconds(jobs: Array<{ wait_seconds: number }>): number {
  if (jobs.length === 0) return 0;
  const sum = jobs.reduce((acc, j) => acc + (j.wait_seconds ?? 0), 0);
  return Math.round(sum / jobs.length);
}

function newestUpdate(
  usages: Array<{ last_updated: string }>,
): Date | null {
  let best: number | null = null;
  for (const u of usages) {
    const t = Date.parse(u.last_updated);
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best);
}
