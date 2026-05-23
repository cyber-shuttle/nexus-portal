"use client";

import {
  useAdminAllocationsFull,
  useAdminChangeRequests,
  useAdminProjectsFull,
  useAdminResources,
  useAdminStats,
} from "@features/admin/queries";
import { usePacketStats } from "@features/amie/queries";
import {
  type AdminAtRiskRow,
  type AdminProjectBurn,
  type ComplianceCellInput,
  type DailyResourceBucket,
  atRiskAllocations,
  bucketUsageByDayResource,
  complianceCell,
  sitePace,
  topProjectsByBurn,
} from "@features/analytics/aggregations";
import {
  AdminAnalytics,
  type AdminKpiBundle,
  type AdminMatrixProject,
  type AdminMatrixResource,
} from "@features/analytics/components/AdminAnalytics";
import { getAllocationUsages } from "@features/usage/api";
import { usageKeys } from "@features/usage/queries";
import { useSavedViewsToolbar } from "@features/analytics/views/components/SavedViewsToolbar";
import { forecast, topN } from "@shared/api/aggregator";
import { useAbility } from "@shared/casl/AbilityProvider";
import type { DateRangeValue } from "@/shared/ui/DateRangePicker";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { useUrlGroupBy } from "@/shared/hooks/useUrlGroupBy";
import { useUrlRange } from "@/shared/hooks/useUrlRange";
import { useQueries } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import * as React from "react";

const ANALYTICS_USAGE_LIMIT = 2000;
const TOP_PROJECTS_LIMIT = 10;
const MATRIX_COLUMN_LIMIT = 10;
const AT_RISK_FORECAST_BUFFER_DAYS = 0;
// Caps the at-risk table render so a site with hundreds of resource breakouts
// doesn't blow the page open. Sort is `daysToExhaust` asc — the most urgent
// rows survive the cap. Tracked in docs/backend-contracts/analytics.md.
const AT_RISK_ROW_LIMIT = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// Route-level fan-out per spec §5.2 + §6.3. Composes site-wide projects +
// allocations + per-allocation usages + AMIE packet stats + admin stats +
// pending change-requests. Heavy in v1 — site-wide usage uses N
// `/compute-allocations/{id}/usages` calls; the gap is documented in
// docs/backend-contracts/analytics.md.
export type AdminAnalyticsContainerProps = {
  userId: string;
};

export function AdminAnalyticsContainer({ userId }: AdminAnalyticsContainerProps) {
  const ability = useAbility();
  const router = useRouter();
  const { range, setRange } = useUrlRange();
  // Spec §6.3 toolbar: Resource / Project / Org chips → URL `?gb=` slots 0/1/2.
  const { groupBy, setGroupBy } = useUrlGroupBy();
  const groupByResource = groupBy[0] ?? "all";
  const groupByProject = groupBy[1] ?? "all";
  const groupByOrg = groupBy[2] ?? "all";

  // Saved-views toolbar slots. The hook owns the atomic URL write so range
  // + group_by land in one router.replace (spec §5.3 + §9 Phase A4).
  const savedViewSlots = useSavedViewsToolbar({
    persona: "admin",
    userId,
    range,
    groupBy: [groupByResource, groupByProject, groupByOrg],
  });

  // CASL gate: admin gets `manage Analytics` (explicit rule); also covered by
  // `manage all`. Early-return per §8 conformance.
  const canManage = ability.can("manage", "Analytics");

  const projectsQuery = useAdminProjectsFull();
  const allocationsQuery = useAdminAllocationsFull();
  const resourcesQuery = useAdminResources();
  const statsQuery = useAdminStats();
  const changeRequestsQuery = useAdminChangeRequests({ status: "PENDING" });
  const amieStatsQuery = usePacketStats({ window: "30d" });

  const allocations = React.useMemo(
    () => allocationsQuery.data ?? [],
    [allocationsQuery.data],
  );

  const usageParams = {
    limit: ANALYTICS_USAGE_LIMIT,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  };
  // Site-wide usage fan-out (spec §6.3 caveat — N calls in v1; replace with
  // /compute-allocation-usages/site-total once the backend ships it).
  const usageQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: usageKeys.list(a.id, usageParams),
      queryFn: () => getAllocationUsages(a.id, usageParams),
      enabled: true,
    })),
  });

  if (!canManage) {
    return <ErrorState heading="Not permitted" />;
  }

  const isLoading =
    projectsQuery.isLoading ||
    allocationsQuery.isLoading ||
    resourcesQuery.isLoading ||
    statsQuery.isLoading ||
    changeRequestsQuery.isLoading ||
    amieStatsQuery.isLoading ||
    usageQueries.some((q) => q.isLoading);

  const error =
    (projectsQuery.error as Error | null) ??
    (allocationsQuery.error as Error | null) ??
    (resourcesQuery.error as Error | null) ??
    (statsQuery.error as Error | null) ??
    (changeRequestsQuery.error as Error | null) ??
    (amieStatsQuery.error as Error | null) ??
    (usageQueries.find((q) => q.error)?.error as Error | undefined) ??
    null;

  if (isLoading) return <CenteredSpinner label="Loading analytics" />;
  if (error) return <ErrorState message={error.message} />;

  const projects = projectsQuery.data ?? [];
  const resourceRows = resourcesQuery.data ?? [];
  const stats = statsQuery.data;
  const amieStats = amieStatsQuery.data;

  // Bucket usages by allocation so the per-project rollup is O(allocations).
  const usagesByAllocId = new Map<
    string,
    Array<{
      compute_allocation_id: string;
      compute_allocation_resource_id: string;
      used_su_amount: number;
      last_updated: string;
    }>
  >();
  usageQueries.forEach((q, i) => {
    const alloc = allocations[i];
    if (!alloc) return;
    usagesByAllocId.set(alloc.id, q.data ?? []);
  });
  const flatUsages = Array.from(usagesByAllocId.values()).flat();

  // Per-project rollup for top-projects + compliance matrix lookup.
  const projectAllocs = new Map<string, typeof allocations>();
  for (const a of allocations) {
    if (!projectAllocs.has(a.project_id)) projectAllocs.set(a.project_id, []);
    projectAllocs.get(a.project_id)?.push(a);
  }

  const projectBurns: AdminProjectBurn[] = projects.map((p) => {
    const allocs = projectAllocs.get(p.id) ?? [];
    let used = 0;
    let allocated = 0;
    let firstAllocationId: string | null = null;
    for (const a of allocs) {
      if (!firstAllocationId) firstAllocationId = a.id;
      allocated += a.initial_su_amount;
      const usages = usagesByAllocId.get(a.id) ?? [];
      used += usages.reduce((acc, u) => acc + u.used_su_amount, 0);
    }
    return {
      projectId: p.id,
      projectName: p.title,
      used,
      allocated,
      firstAllocationId,
    };
  });

  const totalAllocated = projectBurns.reduce((acc, p) => acc + p.allocated, 0);
  const totalUsed = projectBurns.reduce((acc, p) => acc + p.used, 0);
  const sitePaceRatio = sitePace(totalUsed, totalAllocated);

  const topProjects = topProjectsByBurn(projectBurns, TOP_PROJECTS_LIMIT);

  // KPI cluster utilization — prefer the admin/resources rollup (it already
  // accounts for accounting-lag clamping per its schema) and average across
  // active resources.
  const activeResources = resourceRows.filter((r) => r.status === "ACTIVE");
  const clusterUtilPct =
    activeResources.length > 0
      ? activeResources.reduce((acc, r) => acc + r.used_pct, 0) /
        activeResources.length /
        100
      : sitePaceRatio;

  const activeProjects = projects.filter((p) => p.status === "ACTIVE").length;

  // Cluster utilization stacked area — re-key the flat usage stream to use
  // the resource id directly so the legend renders as resources.
  const clusterDaily: { rows: DailyResourceBucket[]; seriesKeys: string[] } =
    bucketUsageByDayResource(flatUsages, range.from, range.to);

  // AMIE packet flow — bucket the `byDay` stream by status into the four
  // canonical statuses for the stacked area (spec §6.3).
  const amieDaily = amieStats
    ? bucketAmieByDayStatus(amieStats.byDay)
    : { rows: [], seriesKeys: [] };

  const amiePacketsPerDay = amieStats
    ? Math.round(
        amieStats.byDay.reduce((acc, b) => acc + b.count, 0) /
          Math.max(1, uniqueDates(amieStats.byDay).length),
      )
    : 0;

  const kpis: AdminKpiBundle = {
    siteSuUsed: totalUsed,
    clusterUtilPct,
    activeProjects,
    amiePacketsPerDay,
    failedPackets24h: stats?.amie_failed_24h ?? 0,
  };

  // Compliance matrix rows = projects with at least one allocation; cols =
  // resources by total usage (top N + "Other") to keep the matrix readable
  // per spec §7.6 risk + §6.3 column fold.
  const matrixProjectsRaw: AdminMatrixProject[] = projects
    .filter((p) => (projectAllocs.get(p.id)?.length ?? 0) > 0)
    .map((p) => ({ id: p.id, code: p.originated_id, title: p.title }));

  // Sort resources by total used SU desc, top-N + "Other" merge — spec §6.3.
  const sortedResources = resourceRows
    .slice()
    .sort((a, b) => b.total_used_su - a.total_used_su);
  type Col = AdminMatrixResource & { otherIds?: string[] };
  const matrixResources: Col[] =
    sortedResources.length <= MATRIX_COLUMN_LIMIT
      ? sortedResources.map((r) => ({ id: r.id, name: r.name }))
      : topN<{ id: string; name: string; total_used_su: number }>(
          sortedResources.map((r) => ({
            id: r.id,
            name: r.name,
            total_used_su: r.total_used_su,
          })),
          (r) => r.total_used_su,
          MATRIX_COLUMN_LIMIT - 1,
          "Other resources",
          undefined,
          (rest, label) => ({
            id: "__other__",
            name: label,
            total_used_su: rest.reduce((acc, r) => acc + r.total_used_su, 0),
          }),
        ).map((r) =>
          r.id === "__other__"
            ? { id: r.id, name: r.name, otherIds: sortedResources.slice(MATRIX_COLUMN_LIMIT - 1).map((x) => x.id) }
            : { id: r.id, name: r.name },
        );

  // Build a (project, resource) → ComplianceCellInput map for O(1) cell lookup.
  // `seed` exposes `resourceMappings` (allocation ↔ resource) only on the
  // backend; in the portal we infer the link from the usage rows we already
  // have, which carry both `compute_allocation_id` and
  // `compute_allocation_resource_id`.
  const cellInputs = new Map<string, ComplianceCellInput & { allocationId: string }>();
  // Track total allocated per (alloc, resource) — usage rows give us used but
  // we treat the allocation's full `initial_su_amount` as the capacity unless
  // we have a per-resource override. For the matrix we want per-resource
  // allocated which we can't derive without resource mappings; fall back to
  // the allocation's total split evenly across the resources it touched.
  const usageByAllocResource = new Map<
    string,
    Map<string, { used: number; firstAlloc: string }>
  >();
  for (const u of flatUsages) {
    const alloc = allocations.find((a) => a.id === u.compute_allocation_id);
    if (!alloc) continue;
    const projectId = alloc.project_id;
    if (!usageByAllocResource.has(projectId)) {
      usageByAllocResource.set(projectId, new Map());
    }
    const byResource = usageByAllocResource.get(projectId);
    if (!byResource) continue;
    const prev = byResource.get(u.compute_allocation_resource_id);
    byResource.set(u.compute_allocation_resource_id, {
      used: (prev?.used ?? 0) + u.used_su_amount,
      firstAlloc: prev?.firstAlloc ?? alloc.id,
    });
  }

  // Per-(project, resource) allocated approximation: take the project's
  // total allocated and split it evenly across the resources the project has
  // usage on. This is the same heuristic noted in `analytics.md` for the
  // missing per-resource budget — documented as a known approximation.
  const allocatedByProjectResource = new Map<string, Map<string, number>>();
  for (const project of projects) {
    const allocs = projectAllocs.get(project.id) ?? [];
    const totalProjectAllocated = allocs.reduce(
      (acc, a) => acc + a.initial_su_amount,
      0,
    );
    const usedResources = Array.from(
      usageByAllocResource.get(project.id)?.keys() ?? [],
    );
    if (usedResources.length === 0 || totalProjectAllocated <= 0) continue;
    const perResource = totalProjectAllocated / usedResources.length;
    const map = new Map<string, number>();
    for (const rid of usedResources) map.set(rid, perResource);
    allocatedByProjectResource.set(project.id, map);
  }

  // Materialize cell inputs keyed by `${projectId}::${resourceId}` (or
  // "Other resources" for the folded column).
  function cellKey(projectId: string, resourceId: string): string {
    return `${projectId}::${resourceId}`;
  }
  for (const project of matrixProjectsRaw) {
    const byResource = usageByAllocResource.get(project.id);
    if (!byResource) continue;
    const allocatedMap = allocatedByProjectResource.get(project.id);
    for (const [resourceId, { used, firstAlloc }] of byResource.entries()) {
      cellInputs.set(cellKey(project.id, resourceId), {
        used,
        allocated: allocatedMap?.get(resourceId) ?? 0,
        allocationId: firstAlloc,
      });
    }
  }

  const matrixProjects = matrixProjectsRaw;

  const matrixCell = (project: AdminMatrixProject, resource: AdminMatrixResource) => {
    if (resource.id === "__other__") {
      const other = resource as Col;
      const otherIds = other.otherIds ?? [];
      let used = 0;
      let allocated = 0;
      for (const rid of otherIds) {
        const c = cellInputs.get(cellKey(project.id, rid));
        if (!c) continue;
        used += c.used;
        allocated += c.allocated;
      }
      return complianceCell(allocated > 0 ? { used, allocated } : null);
    }
    const input = cellInputs.get(cellKey(project.id, resource.id));
    return complianceCell(input ?? null);
  };

  const matrixCellAllocationId = (
    project: AdminMatrixProject,
    resource: AdminMatrixResource,
  ): string | null => {
    if (resource.id === "__other__") {
      const other = resource as Col;
      const otherIds = other.otherIds ?? [];
      for (const rid of otherIds) {
        const c = cellInputs.get(cellKey(project.id, rid));
        if (c) return c.allocationId;
      }
      return null;
    }
    return cellInputs.get(cellKey(project.id, resource.id))?.allocationId ?? null;
  };

  // At-risk allocations — enumerate (allocation × resource) so the table
  // names the specific resource the project will burn through first instead
  // of collapsing to one row per allocation (A6 polish, A4 carry-over F6).
  // Per-resource capacity is the same even-split heuristic as the compliance
  // matrix; documented in docs/backend-contracts/analytics.md.
  const resourceNameById = new Map(resourceRows.map((r) => [r.id, r.name]));
  const atRiskRows: AdminAtRiskRow[] = [];
  for (const a of allocations) {
    const usages = usagesByAllocId.get(a.id) ?? [];
    const project = projects.find((p) => p.id === a.project_id);
    const endMs = Date.parse(a.end_time);
    const endDate = Number.isNaN(endMs) ? null : new Date(endMs);

    // Group usages by resource within this allocation.
    const usagesByResource = new Map<string, typeof usages>();
    for (const u of usages) {
      const rid = u.compute_allocation_resource_id;
      if (!rid) continue;
      const arr = usagesByResource.get(rid) ?? [];
      arr.push(u);
      usagesByResource.set(rid, arr);
    }
    if (usagesByResource.size === 0) continue;

    const perResourceBudget = a.initial_su_amount / usagesByResource.size;
    for (const [resourceId, resourceUsages] of usagesByResource.entries()) {
      const used = resourceUsages.reduce((acc, u) => acc + u.used_su_amount, 0);
      const f = forecast(
        resourceUsages.map((u) => ({
          used_su_amount: u.used_su_amount,
          last_updated: u.last_updated,
        })),
        { ...a, initial_su_amount: perResourceBudget },
        range.to.getTime(),
      );
      atRiskRows.push({
        projectId: a.project_id,
        projectName: project?.title ?? a.project_id,
        resourceId,
        resourceName: resourceNameById.get(resourceId) ?? resourceId,
        allocationId: a.id,
        usedPct: perResourceBudget > 0 ? (used / perResourceBudget) * 100 : 0,
        daysToExhaust: f.daysRemaining,
        endDate,
        ownerId: project?.project_pi_id ?? "—",
      });
    }
  }
  const atRisk = atRiskAllocations(atRiskRows)
    .filter((r) => {
      // Defense-in-depth on top of `atRiskAllocations`: also drop rows whose
      // forecast exhaust falls within `AT_RISK_FORECAST_BUFFER_DAYS` of now.
      if (r.daysToExhaust === null) return false;
      return r.daysToExhaust >= AT_RISK_FORECAST_BUFFER_DAYS;
    })
    .slice(0, AT_RISK_ROW_LIMIT);

  const dateRangeValue: DateRangeValue = {
    from: range.from,
    to: range.to,
    preset: range.preset,
  };

  const syncedAt = newestUpdate(flatUsages) ?? new Date();

  // Per spec §6.3: clicking a packet-flow segment opens the AMIE inbox
  // pre-filtered to that status. We forward `from` so the inbox window
  // matches what the user was looking at (A3 carry-over F2).
  const onAmieSegmentClick = (seriesKey: string, _date: string) => {
    const params = new URLSearchParams();
    params.set("status", seriesKey);
    params.set("from", range.from.toISOString());
    router.push(`/admin/amie/packets?${params.toString()}`);
  };

  return (
    <AdminAnalytics
      syncedAt={syncedAt}
      onRefetch={() => {
        for (const q of usageQueries) q.refetch();
        statsQuery.refetch();
        amieStatsQuery.refetch();
        changeRequestsQuery.refetch();
      }}
      range={dateRangeValue}
      onRangeChange={(next) =>
        setRange({ from: next.from, to: next.to, preset: next.preset ?? "custom" })
      }
      groupByResource={groupByResource}
      onGroupByResourceChange={(next) =>
        setGroupBy([next, groupByProject, groupByOrg])
      }
      groupByProject={groupByProject}
      onGroupByProjectChange={(next) =>
        setGroupBy([groupByResource, next, groupByOrg])
      }
      groupByOrg={groupByOrg}
      onGroupByOrgChange={(next) =>
        setGroupBy([groupByResource, groupByProject, next])
      }
      kpis={kpis}
      clusterUtilization={clusterDaily}
      topProjects={topProjects}
      amieFlow={amieDaily}
      matrixProjects={matrixProjects}
      matrixResources={matrixResources}
      matrixCell={matrixCell}
      matrixCellAllocationId={matrixCellAllocationId}
      atRisk={atRisk}
      matrixApproximate
      onAmieSegmentClick={onAmieSegmentClick}
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

function uniqueDates(byDay: Array<{ date: string }>): string[] {
  return Array.from(new Set(byDay.map((b) => b.date)));
}

// Folds the per-day per-status AMIE counts into the four canonical statuses
// for the stacked area chart. Empty days are kept so the time axis stays
// contiguous (spec §8 chart contract).
function bucketAmieByDayStatus(
  byDay: Array<{ date: string; status: string; count: number }>,
): { rows: DailyResourceBucket[]; seriesKeys: string[] } {
  const STATUSES = ["NEW", "DECODED", "PROCESSED", "FAILED"];
  const dates = Array.from(new Set(byDay.map((b) => b.date))).sort();
  const rows: DailyResourceBucket[] = dates.map((date) => {
    const row: DailyResourceBucket = { date };
    for (const s of STATUSES) row[s] = 0;
    return row;
  });
  const byDate = new Map<string, DailyResourceBucket>();
  for (const r of rows) byDate.set(String(r.date), r);
  for (const b of byDay) {
    if (!STATUSES.includes(b.status)) continue;
    const row = byDate.get(b.date);
    if (!row) continue;
    row[b.status] = ((row[b.status] as number) ?? 0) + b.count;
  }
  return { rows, seriesKeys: STATUSES };
}
