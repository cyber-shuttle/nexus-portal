"use client";

import {
  isProjectAtRisk,
  projectForecast,
  projectsAtRiskCount,
  topMembers as topMembersAgg,
  type MemberContribution,
  type PiProjectRollup,
} from "@features/analytics/aggregations";
import {
  PiAnalytics,
  type PiAnalyticsProps,
  type PiKpiBundle,
} from "@features/analytics/components/PiAnalytics";
import {
  type ResourceMixSlice,
  bucketUsageByDayResource,
  resourceMix as resourceMixAgg,
} from "@features/analytics/aggregations";
import { useChangeRequestsForUser } from "@features/change-requests/queries";
import { getMembershipsForAllocation } from "@features/members/api";
import { memberKeys } from "@features/members/queries";
import { getProjectComputeAllocations } from "@features/projects/api";
import { projectKeys, useProjectsAsPi } from "@features/projects/queries";
import { getAllocationUsages, getAllocationUserUsageTotal } from "@features/usage/api";
import { usageKeys } from "@features/usage/queries";
import { useSavedViewsToolbar } from "@features/analytics/views/components/SavedViewsToolbar";
import type { SavedView } from "@features/analytics/views/types";
import { forecast } from "@shared/api/aggregator";
import type { ComputeAllocation } from "@shared/api/domain";
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
const TOP_PROJECTS_FOR_BURN = 6;
const TOP_MEMBERS = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PiAnalyticsContainerProps = {
  userId: string;
};

// Route-level fan-out per spec §5.2. PI page composes:
//   projects-as-pi -> compute-allocations per project -> usage list per allocation
//   + per-allocation members + per-allocation/per-user totals + change-requests.
// Feature components consume the bundled props.
export function PiAnalyticsContainer({ userId }: PiAnalyticsContainerProps) {
  const ability = useAbility();
  const { range, setRange } = useUrlRange();
  // Spec §6.2 toolbar: Project, Member, Resource chips → URL `?gb=` slots 0/1/2.
  const { groupBy, setGroupBy } = useUrlGroupBy();
  const groupByProject = groupBy[0] ?? "all";
  const groupByMember = groupBy[1] ?? "all";
  const groupByResource = groupBy[2] ?? "all";

  // Saved-views toolbar slots. Apply-time we write both range and groupBy
  // back to the URL via the existing setters (spec §5.3 + §9 Phase A4).
  const applySavedView = React.useCallback(
    (view: SavedView) => {
      const fromMs = Date.parse(view.range.from);
      const toMs = Date.parse(view.range.to);
      if (!Number.isNaN(fromMs) && !Number.isNaN(toMs)) {
        setRange({
          from: new Date(fromMs),
          to: new Date(toMs),
          preset: view.range.preset,
        });
      }
      setGroupBy(view.group_by);
    },
    [setRange, setGroupBy],
  );
  const savedViewSlots = useSavedViewsToolbar({
    persona: "pi",
    userId,
    range,
    groupBy: [groupByProject, groupByMember, groupByResource],
    onApply: applySavedView,
  });

  const projectsQuery = useProjectsAsPi(userId);
  const projects = React.useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data],
  );

  // Per-project allocation lists. useQueries gives a stable array indexed by
  // project so we can re-zip with the project list.
  const allocsByProjectQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: projectKeys.allocations(p.id),
      queryFn: () => getProjectComputeAllocations(p.id),
      enabled: true,
    })),
  });

  const allAllocations: ComputeAllocation[] = React.useMemo(
    () =>
      allocsByProjectQueries
        .flatMap((q) => q.data ?? [])
        .filter((a): a is ComputeAllocation => Boolean(a)),
    [allocsByProjectQueries],
  );

  const usageParams = {
    limit: ANALYTICS_USAGE_LIMIT,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  };
  const usageQueries = useQueries({
    queries: allAllocations.map((a) => ({
      queryKey: usageKeys.list(a.id, usageParams),
      queryFn: () => getAllocationUsages(a.id, usageParams),
      enabled: true,
    })),
  });

  const membersQueries = useQueries({
    queries: allAllocations.map((a) => ({
      queryKey: memberKeys.forAllocation(a.id),
      queryFn: () => getMembershipsForAllocation(a.id),
      enabled: true,
    })),
  });

  // Per-allocation/per-user totals — fan-out scales as
  // (#allocations × #members per allocation). Spec §6.2 + §12 acknowledge this
  // for v1; backend ticket tracked in docs/backend-contracts/analytics.md.
  const memberTotalKeys: Array<{ allocationId: string; userId: string }> =
    React.useMemo(() => {
      const out: Array<{ allocationId: string; userId: string }> = [];
      membersQueries.forEach((q, i) => {
        const alloc = allAllocations[i];
        if (!alloc) return;
        const memberships = q.data ?? [];
        for (const m of memberships) {
          out.push({ allocationId: alloc.id, userId: m.user_id });
        }
      });
      return out;
    }, [membersQueries, allAllocations]);

  const memberTotalsQueries = useQueries({
    queries: memberTotalKeys.map(({ allocationId, userId: uid }) => ({
      queryKey: usageKeys.userTotal(allocationId, uid),
      queryFn: () => getAllocationUserUsageTotal(allocationId, uid),
      enabled: true,
    })),
  });

  const changeRequestsQuery = useChangeRequestsForUser(userId);

  const projectIds = React.useMemo(() => projects.map((p) => p.id), [projects]);
  // CASL gate: PI is allowed to read AnalyticsPI for every project they own.
  // We only fail the gate when there's at least one project AND none of them
  // pass the ability check — empty-projects falls through to the "no projects"
  // render below rather than a 403-style ErrorState.
  const canReadAny =
    projectIds.length === 0 ||
    projectIds.some((projectId) =>
      ability.can("read", subject("AnalyticsPI", { projectId })),
    );

  if (!canReadAny) {
    return <ErrorState heading="Not permitted" />;
  }

  const isLoading =
    projectsQuery.isLoading ||
    allocsByProjectQueries.some((q) => q.isLoading) ||
    usageQueries.some((q) => q.isLoading) ||
    membersQueries.some((q) => q.isLoading) ||
    memberTotalsQueries.some((q) => q.isLoading) ||
    changeRequestsQuery.isLoading;

  const error =
    (projectsQuery.error as Error | null) ??
    (allocsByProjectQueries.find((q) => q.error)?.error as Error | undefined) ??
    (usageQueries.find((q) => q.error)?.error as Error | undefined) ??
    (membersQueries.find((q) => q.error)?.error as Error | undefined) ??
    (memberTotalsQueries.find((q) => q.error)?.error as Error | undefined) ??
    (changeRequestsQuery.error as Error | null) ??
    null;

  if (isLoading) return <CenteredSpinner label="Loading analytics" />;
  if (error) return <ErrorState message={error.message} />;

  // Project rollup: per project, fold its allocations' used/allocated, pick
  // the latest end date and the earliest forecast exhaust across them.
  const usageByAllocationId = new Map<
    string,
    Array<{ used_su_amount: number; last_updated: string }>
  >();
  usageQueries.forEach((q, i) => {
    const alloc = allAllocations[i];
    if (!alloc) return;
    usageByAllocationId.set(
      alloc.id,
      (q.data ?? []).map((u) => ({
        used_su_amount: u.used_su_amount,
        last_updated: u.last_updated,
      })),
    );
  });

  const pendingCrsByAllocation = new Map<string, number>();
  for (const cr of changeRequestsQuery.data ?? []) {
    if (cr.change_status !== "PENDING") continue;
    pendingCrsByAllocation.set(
      cr.compute_allocation_id,
      (pendingCrsByAllocation.get(cr.compute_allocation_id) ?? 0) + 1,
    );
  }

  // `daysToEndOfRange` extrapolates from "now" to `range.to` so the projected
  // hatched segment shows what window-end consumption looks like at the
  // current burn rate. When the window ends in the past we collapse to 0
  // (projected == used) per A2 N5 carry-over.
  const nowMs = Date.now();
  const daysToEndOfRange = Math.max(0, (range.to.getTime() - nowMs) / DAY_MS);
  const windowDays = Math.max(
    1,
    (range.to.getTime() - range.from.getTime()) / DAY_MS,
  );

  const projectRollups: PiProjectRollup[] = projects.map((project, projIdx) => {
    const projectAllocs = allocsByProjectQueries[projIdx]?.data ?? [];
    let used = 0;
    let allocated = 0;
    let latestEnd: Date | null = null;
    let pending = 0;
    const exhausts: Array<{ forecastExhaust: Date | null }> = [];
    let firstAllocationId: string | null = null;
    for (const a of projectAllocs) {
      if (!firstAllocationId) firstAllocationId = a.id;
      allocated += a.initial_su_amount;
      const usages = usageByAllocationId.get(a.id) ?? [];
      used += usages.reduce((acc, u) => acc + u.used_su_amount, 0);
      const endMs = Date.parse(a.end_time);
      if (!Number.isNaN(endMs)) {
        const end = new Date(endMs);
        if (!latestEnd || end.getTime() > latestEnd.getTime()) latestEnd = end;
      }
      const f = forecast(usages, a, range.to.getTime());
      exhausts.push({ forecastExhaust: f.exhaustDate });
      pending += pendingCrsByAllocation.get(a.id) ?? 0;
    }
    const exhaust = projectForecast(exhausts);
    const burnRatePerDay = used / windowDays;
    const projected = Math.min(allocated, used + burnRatePerDay * daysToEndOfRange);
    return {
      projectId: project.id,
      projectName: project.title,
      used,
      projected,
      allocated,
      forecastExhaust: exhaust,
      endDate: latestEnd,
      atRisk: isProjectAtRisk(exhaust, latestEnd),
      pendingChangeRequests: pending,
      firstAllocationId,
    };
  });

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;
  const totalSuUsed = projectRollups.reduce((acc, r) => acc + r.used, 0);
  const avgBurnPerProject =
    projectRollups.length > 0 ? totalSuUsed / projectRollups.length : 0;
  const projectsAtRisk = projectsAtRiskCount(projectRollups);
  const pendingChangeRequests = (changeRequestsQuery.data ?? []).filter(
    (cr) => cr.change_status === "PENDING",
  ).length;

  const kpis: PiKpiBundle = {
    activeProjects,
    totalSuUsed,
    avgBurnPerProject,
    projectsAtRisk,
    pendingChangeRequests,
  };

  // Burn-by-project: top 6 by `used` desc (spec §6.2 card title).
  const topProjects = projectRollups.slice().sort((a, b) => b.used - a.used).slice(
    0,
    TOP_PROJECTS_FOR_BURN,
  );

  // Usage trend by project — re-bucket flat usages with `compute_allocation_id`
  // remapped to the project id so the stacked area legend reads as projects.
  const allocToProject = new Map<string, string>();
  for (const [projIdx, project] of projects.entries()) {
    for (const a of allocsByProjectQueries[projIdx]?.data ?? []) {
      allocToProject.set(a.id, project.id);
    }
  }
  const flatUsagesForTrend = usageQueries.flatMap((q, i) => {
    const alloc = allAllocations[i];
    if (!alloc) return [];
    const projectId = allocToProject.get(alloc.id) ?? alloc.id;
    return (q.data ?? []).map((u) => ({
      compute_allocation_id: projectId, // re-key so series == project id
      compute_allocation_resource_id: projectId,
      used_su_amount: u.used_su_amount,
      last_updated: u.last_updated,
    }));
  });
  const usageByProject = bucketUsageByDayResource(
    flatUsagesForTrend,
    range.from,
    range.to,
  );

  // Member contributions: per-allocation/per-user totals folded by user.
  const memberContribs: MemberContribution[] = [];
  for (const [i, key] of memberTotalKeys.entries()) {
    const total = memberTotalsQueries[i]?.data?.total_su_amount ?? 0;
    if (total <= 0) continue;
    memberContribs.push({ user_id: key.userId, total });
  }
  const memberRows = topMembersAgg(memberContribs, TOP_MEMBERS);

  // For the drill drawer, map user_id -> their per-allocation totals.
  const memberUsageByAllocation: PiAnalyticsProps["memberUsageByAllocation"] = {};
  for (const [i, key] of memberTotalKeys.entries()) {
    const total = memberTotalsQueries[i]?.data?.total_su_amount ?? 0;
    if (!memberUsageByAllocation[key.userId]) memberUsageByAllocation[key.userId] = [];
    memberUsageByAllocation[key.userId]?.push({
      allocation_id: key.allocationId,
      total,
    });
  }

  // Resource mix from the flat usage stream.
  const flatUsages = usageQueries.flatMap((q, i) => {
    const alloc = allAllocations[i];
    if (!alloc) return [];
    return (q.data ?? []).map((u) => ({
      compute_allocation_id: alloc.id,
      compute_allocation_resource_id: u.compute_allocation_resource_id,
      used_su_amount: u.used_su_amount,
      last_updated: u.last_updated,
    }));
  });
  const mix: ResourceMixSlice[] = resourceMixAgg(flatUsages);

  const dateRangeValue: DateRangeValue = {
    from: range.from,
    to: range.to,
    preset: range.preset,
  };

  const syncedAt = newestUpdate(flatUsages) ?? new Date();

  return (
    <PiAnalytics
      syncedAt={syncedAt}
      onRefetch={() => {
        for (const q of usageQueries) q.refetch();
        for (const q of memberTotalsQueries) q.refetch();
        changeRequestsQuery.refetch();
      }}
      range={dateRangeValue}
      onRangeChange={(next) =>
        setRange({ from: next.from, to: next.to, preset: next.preset ?? "custom" })
      }
      groupByProject={groupByProject}
      onGroupByProjectChange={(next) =>
        setGroupBy([next, groupByMember, groupByResource])
      }
      groupByMember={groupByMember}
      onGroupByMemberChange={(next) =>
        setGroupBy([groupByProject, next, groupByResource])
      }
      groupByResource={groupByResource}
      onGroupByResourceChange={(next) =>
        setGroupBy([groupByProject, groupByMember, next])
      }
      kpis={kpis}
      topProjects={topProjects}
      usageByProject={usageByProject}
      topMembers={memberRows}
      memberUsageByAllocation={memberUsageByAllocation}
      resourceMix={mix}
      projects={projectRollups}
      savedViewsChips={savedViewSlots.chips}
      saveViewTrigger={savedViewSlots.trigger}
    />
  );
}

function newestUpdate(usages: Array<{ last_updated: string }>): Date | null {
  let best: number | null = null;
  for (const u of usages) {
    const t = Date.parse(u.last_updated);
    if (Number.isNaN(t)) continue;
    if (best === null || t > best) best = t;
  }
  return best === null ? null : new Date(best);
}
