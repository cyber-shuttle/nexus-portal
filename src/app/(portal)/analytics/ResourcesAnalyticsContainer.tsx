"use client";

import { useAdminAllocationsFull, useAdminProjectsFull } from "@features/admin/queries";
import { getAllocation, getAllocationResources } from "@features/allocations/api";
import { allocationKeys } from "@features/allocations/queries";
import {
  groupTotals,
  resourceGroupMatrix,
  topConsumers as topConsumersAgg,
  bucketUsageByDayResource,
  type DailyResourceBucket,
  type ResourceUsagePoint,
} from "@features/analytics/aggregations";
import {
  ResourcesAnalytics,
  type ResourcesGroupBy,
  type ResourcesKpiBundle,
  type ResourcesMatrixGroup,
  type ResourcesMatrixResource,
} from "@features/analytics/components/ResourcesAnalytics";
import { useSavedViewsToolbar } from "@features/analytics/views/components/SavedViewsToolbar";
import { getMembershipsForAllocation, getUserById } from "@features/members/api";
import { memberKeys, useMembershipsForUser } from "@features/members/queries";
import {
  getProjectComputeAllocations,
  getProjectsAsPi,
  getProjectsForUser,
} from "@features/projects/api";
import { projectKeys } from "@features/projects/queries";
import { getAllocationUsages } from "@features/usage/api";
import { usageKeys } from "@features/usage/queries";
import type { ComplianceCell } from "@/shared/charts/ComplianceMatrix";
import type { AnalyticsPersona } from "@/shared/auth/personaForAnalytics";
import { useAbility } from "@shared/casl/AbilityProvider";
import type { DateRangeValue } from "@/shared/ui/DateRangePicker";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { useUrlGroupBy } from "@/shared/hooks/useUrlGroupBy";
import { useUrlRange } from "@/shared/hooks/useUrlRange";
import { subject } from "@casl/ability";
import { useQueries, useQuery } from "@tanstack/react-query";
import * as React from "react";

const ANALYTICS_USAGE_LIMIT = 2000;
const MATRIX_TOP_RESOURCES = 10;
const MATRIX_TOP_GROUPS = 10;
const CONSUMERS_TOP_N = 10;
const CALLOUT_TOP_N = 5;

export type ResourcesAnalyticsContainerProps = {
  persona: AnalyticsPersona;
  userId: string;
};

// Resources tab fan-out (TF3). Same per-persona scope rules as the other
// containers: researcher = own memberships, PI = projects-as-PI, admin =
// site-wide. The data shape is identical across personas so a single
// presentational component renders all three — only scope and labels differ.
//
// Aggregation is client-side: per-allocation `/usages` fan-out feeds the
// `groupTotals` + `resourceGroupMatrix` aggregators. The proposed
// `/compute-allocation-usages/aggregate` endpoint (see
// docs/backend-contracts/analytics.md §8) collapses the fan-out when the
// backend ships it; the swap is a query replacement, not a UI rewrite.
export function ResourcesAnalyticsContainer({
  persona,
  userId,
}: ResourcesAnalyticsContainerProps) {
  const ability = useAbility();
  const { range, setRange } = useUrlRange();
  const { groupBy: groupBySlots, setGroupBy } = useUrlGroupBy();
  const groupBy = (groupBySlots[0] as ResourcesGroupBy | undefined) ?? "allocation";

  const savedViewSlots = useSavedViewsToolbar({
    persona,
    userId,
    range,
    groupBy: [groupBy],
  });

  // Researcher path — own memberships → distinct allocation ids.
  const researcherMembershipsQuery = useMembershipsForUser(userId);
  const researcherAllocIds = React.useMemo(() => {
    if (persona !== "researcher") return [];
    const memberships = researcherMembershipsQuery.data ?? [];
    return Array.from(new Set(memberships.map((m) => m.compute_allocation_id)));
  }, [persona, researcherMembershipsQuery.data]);

  // PI path — projects-as-pi → per-project allocation lists.
  const piProjectsQuery = useQuery({
    queryKey: projectKeys.asPi(userId),
    queryFn: () => getProjectsAsPi(userId),
    enabled: persona === "pi",
  });
  const piProjectIds = React.useMemo(() => {
    if (persona !== "pi") return [] as string[];
    return (piProjectsQuery.data ?? []).map((p) => p.id);
  }, [persona, piProjectsQuery.data]);
  const piAllocsByProjectQueries = useQueries({
    queries: piProjectIds.map((id) => ({
      queryKey: projectKeys.allocations(id),
      queryFn: () => getProjectComputeAllocations(id),
      enabled: persona === "pi",
    })),
  });
  const piAllocIds = React.useMemo(() => {
    if (persona !== "pi") return [] as string[];
    const ids = new Set<string>();
    for (const q of piAllocsByProjectQueries) {
      for (const a of q.data ?? []) ids.add(a.id);
    }
    return Array.from(ids);
  }, [persona, piAllocsByProjectQueries]);

  // Admin path — full site allocation enumeration.
  const adminAllocationsQuery = useAdminAllocationsFull(
    {},
    { enabled: persona === "admin" },
  );
  const adminProjectsQuery = useAdminProjectsFull({ enabled: persona === "admin" });
  const adminAllocIds = React.useMemo(() => {
    if (persona !== "admin") return [] as string[];
    return (adminAllocationsQuery.data ?? []).map((a) => a.id);
  }, [persona, adminAllocationsQuery.data]);

  const allocationIds =
    persona === "researcher"
      ? researcherAllocIds
      : persona === "pi"
        ? piAllocIds
        : adminAllocIds;

  // Allocation details — needed for the "by allocation" label + project tie-back.
  const allocationDetailQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: allocationKeys.detail(id),
      queryFn: () => getAllocation(id),
      enabled: true,
    })),
  });
  // Per-allocation resources — feeds resource names for the callout, matrix,
  // and "by resource" column labels.
  const allocationResourcesQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: allocationKeys.resources(id),
      queryFn: () => getAllocationResources(id),
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

  // Memberships per allocation — needed to fold "by user" into something
  // useful for the matrix labels even when the persona scope is admin.
  const membersQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: memberKeys.forAllocation(id),
      queryFn: () => getMembershipsForAllocation(id),
      enabled: true,
    })),
  });

  // Researcher gate: explicit AnalyticsResearcher rule covers self; PI and
  // admin gates are enforced on their respective containers — for resources
  // we accept either of (AnalyticsResearcher, AnalyticsPI on any project,
  // manage Analytics) per spec §6.4 (everyone has scoped read).
  const canRead = React.useMemo(() => {
    if (persona === "admin") return ability.can("manage", "Analytics");
    if (persona === "pi") {
      return (
        piProjectIds.length === 0 ||
        piProjectIds.some((pid) => ability.can("read", subject("AnalyticsPI", { projectId: pid })))
      );
    }
    return ability.can("read", subject("AnalyticsResearcher", { userId }));
  }, [persona, ability, piProjectIds, userId]);

  // User name fetch — collected after we have membership ids so the lookup
  // table for the "by user" labels stays scoped to memberships in range.
  const userIdSet = React.useMemo(() => {
    const ids = new Set<string>();
    for (const q of membersQueries) {
      for (const m of q.data ?? []) ids.add(m.user_id);
    }
    return ids;
  }, [membersQueries]);

  const userQueries = useQueries({
    queries: Array.from(userIdSet).map((id) => ({
      queryKey: memberKeys.user(id),
      queryFn: () => getUserById(id),
      enabled: true,
    })),
  });

  // Project name fetch for PI scope (admin already has the projects-full
  // payload; researchers fold project labels from the same /me/projects walk
  // via the membership chain).
  const researcherProjectsQuery = useQuery({
    queryKey: projectKeys.forUser(userId),
    queryFn: () => getProjectsForUser(userId),
    enabled: persona === "researcher",
  });

  if (!canRead) {
    return <ErrorState heading="Not permitted" />;
  }

  const isLoading =
    (persona === "researcher" && researcherMembershipsQuery.isLoading) ||
    (persona === "pi" &&
      (piProjectsQuery.isLoading || piAllocsByProjectQueries.some((q) => q.isLoading))) ||
    (persona === "admin" &&
      (adminAllocationsQuery.isLoading || adminProjectsQuery.isLoading)) ||
    allocationDetailQueries.some((q) => q.isLoading) ||
    allocationResourcesQueries.some((q) => q.isLoading) ||
    usageQueries.some((q) => q.isLoading) ||
    membersQueries.some((q) => q.isLoading) ||
    userQueries.some((q) => q.isLoading) ||
    (persona === "researcher" && researcherProjectsQuery.isLoading);

  const firstError =
    (researcherMembershipsQuery.error as Error | null) ??
    (piProjectsQuery.error as Error | null) ??
    (piAllocsByProjectQueries.find((q) => q.error)?.error as Error | undefined) ??
    (adminAllocationsQuery.error as Error | null) ??
    (adminProjectsQuery.error as Error | null) ??
    (allocationDetailQueries.find((q) => q.error)?.error as Error | undefined) ??
    (allocationResourcesQueries.find((q) => q.error)?.error as Error | undefined) ??
    (usageQueries.find((q) => q.error)?.error as Error | undefined) ??
    null;

  if (isLoading) return <CenteredSpinner label="Loading resources" />;
  if (firstError) return <ErrorState message={firstError.message} />;

  const allocations = allocationDetailQueries
    .map((q) => q.data)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  const allocationNameById = new Map(allocations.map((a) => [a.id, a.name]));
  const allocationProjectById = new Map(allocations.map((a) => [a.id, a.project_id]));

  // Resource catalog — flatten the per-allocation resource lists into one
  // id → name map keyed by resource id. Resources may appear in multiple
  // allocations (e.g. cpu-standard); we keep the first observed name since
  // they're identical by design in the seed.
  const resourceNameById = new Map<string, string>();
  for (const q of allocationResourcesQueries) {
    for (const r of q.data ?? []) {
      if (!resourceNameById.has(r.id)) resourceNameById.set(r.id, r.name);
    }
  }

  // User catalog from the membership fan-out.
  const userNameById = new Map<string, string>();
  for (const q of userQueries) {
    const u = q.data;
    if (!u) continue;
    const fullName =
      [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || u.email || u.id;
    userNameById.set(u.id, fullName);
  }

  // Project catalog — from whichever query the persona populated.
  const projectNameById = new Map<string, string>();
  if (persona === "admin") {
    for (const p of adminProjectsQuery.data ?? []) projectNameById.set(p.id, p.title);
  } else if (persona === "pi") {
    for (const p of piProjectsQuery.data ?? []) projectNameById.set(p.id, p.title);
  } else {
    for (const p of researcherProjectsQuery.data ?? []) projectNameById.set(p.id, p.title);
  }

  // Per-allocation membership map — used to attribute usage rows whose
  // `user_id` slot is missing in the seed (synthesis edge case) to a single
  // anchor user so the matrix still has a row. We prefer the seeded user_id
  // on the usage row when present.
  const membershipByAllocationId = new Map<
    string,
    Array<{ user_id: string }>
  >();
  for (let i = 0; i < allocationIds.length; i += 1) {
    const id = allocationIds[i];
    if (!id) continue;
    membershipByAllocationId.set(id, membersQueries[i]?.data ?? []);
  }

  // Materialize the flat usage stream with project/user resolution.
  const flatUsages: ResourceUsagePoint[] = [];
  for (let i = 0; i < usageQueries.length; i += 1) {
    const rows = usageQueries[i]?.data ?? [];
    const allocId = allocationIds[i];
    if (!allocId) continue;
    for (const u of rows) {
      flatUsages.push({
        compute_allocation_id: u.compute_allocation_id,
        compute_allocation_resource_id: u.compute_allocation_resource_id,
        used_su_amount: u.used_su_amount,
        last_updated: u.last_updated,
        user_id: u.user_id,
        project_id: allocationProjectById.get(allocId),
      });
    }
  }

  const totalSus = flatUsages.reduce((acc, u) => acc + u.used_su_amount, 0);

  // Callout rows — share by resource against the whole window total.
  const resourceTotals = groupTotals(
    flatUsages,
    (u) => u.compute_allocation_resource_id || u.compute_allocation_id,
  );
  const calloutRows = resourceTotals.slice(0, CALLOUT_TOP_N).map((t) => ({
    id: t.key,
    name: resourceNameById.get(t.key) ?? t.key,
    used_su: t.total_su,
    share_pct: totalSus > 0 ? (t.total_su / totalSus) * 100 : 0,
  }));

  // KPI labels — top resource by SU, top allocation by SU, most-active user.
  const topAllocationKey = groupTotals(flatUsages, (u) => u.compute_allocation_id)[0]?.key;
  const topUserKey = groupTotals(flatUsages, (u) => u.user_id)[0]?.key;
  const kpis: ResourcesKpiBundle = {
    totalSus,
    topResourceLabel: calloutRows[0]?.name ?? "—",
    topAllocationLabel: topAllocationKey
      ? (allocationNameById.get(topAllocationKey) ?? topAllocationKey)
      : "—",
    topUserLabel: topUserKey ? (userNameById.get(topUserKey) ?? topUserKey) : "—",
  };

  // Group-by selection drives the keying function for both the matrix's
  // group axis and the consumers table.
  const groupKeyOf = (u: ResourceUsagePoint): string | undefined => {
    if (groupBy === "user") return u.user_id;
    if (groupBy === "project") return u.project_id ?? undefined;
    return u.compute_allocation_id;
  };
  const groupLabelOf = (key: string): string => {
    if (groupBy === "user") return userNameById.get(key) ?? key;
    if (groupBy === "project") return projectNameById.get(key) ?? key;
    return allocationNameById.get(key) ?? key;
  };

  const groupTotalsRows = groupTotals(flatUsages, groupKeyOf);
  const topConsumers = topConsumersAgg(groupTotalsRows, groupLabelOf, CONSUMERS_TOP_N);

  // Matrix columns: top N groups; rows: top N resources. We trim to keep the
  // matrix readable per ComplianceMatrix's existing layout budget (spec §6.3
  // reused via the shared chart primitive).
  const matrixResources: ResourcesMatrixResource[] = resourceTotals
    .slice(0, MATRIX_TOP_RESOURCES)
    .map((t) => ({ id: t.key, name: resourceNameById.get(t.key) ?? t.key }));
  const matrixGroups: ResourcesMatrixGroup[] = groupTotalsRows
    .slice(0, MATRIX_TOP_GROUPS)
    .map((t) => ({ key: t.key, label: groupLabelOf(t.key) }));

  const matrix = resourceGroupMatrix(flatUsages, groupKeyOf);
  const matrixMax = (() => {
    let max = 0;
    for (const v of matrix.values()) if (v > max) max = v;
    return max;
  })();

  // Three-band heatmap. TF3 skipped the amber band entirely for WCAG AA at
  // 12px (amber-700 on amber-100 = 4.03:1); TF4 darkens warn text to
  // amber-800 + bold (see ComplianceMatrix bandStyles) which clears 6.28:1,
  // so the band returns. 0.3/0.6 thresholds give green→amber→red parity with
  // the admin A3 compliance matrix.
  function bandFor(value: number): ComplianceCell["band"] {
    if (matrixMax <= 0) return "empty";
    const ratio = value / matrixMax;
    if (ratio === 0) return "empty";
    if (ratio >= 0.6) return "hot";
    if (ratio >= 0.3) return "warn";
    return "ok";
  }

  const matrixCell = (
    resource: ResourcesMatrixResource,
    group: ResourcesMatrixGroup,
  ): ComplianceCell | null => {
    const value = matrix.get(`${resource.id}::${group.key}`) ?? 0;
    if (value <= 0) return { value: 0, band: "empty" };
    return { value, band: bandFor(value) };
  };

  const daily: { rows: DailyResourceBucket[]; seriesKeys: string[] } =
    bucketUsageByDayResource(flatUsages, range.from, range.to);

  const dateRangeValue: DateRangeValue = {
    from: range.from,
    to: range.to,
    preset: range.preset,
  };

  const personaLabel =
    persona === "admin" ? "Admin" : persona === "pi" ? "PI" : "Researcher";
  const scopeNote =
    persona === "admin"
      ? "Site-wide resource consumption across every active allocation."
      : persona === "pi"
        ? "Resource consumption across every project where you are PI."
        : "Resource consumption across every allocation you belong to.";

  const syncedAt = newestUpdate(flatUsages) ?? new Date();

  return (
    <ResourcesAnalytics
      syncedAt={syncedAt}
      onRefetch={() => {
        for (const q of usageQueries) q.refetch();
      }}
      range={dateRangeValue}
      onRangeChange={(next) =>
        setRange({ from: next.from, to: next.to, preset: next.preset ?? "custom" })
      }
      groupBy={groupBy}
      onGroupByChange={(next) => setGroupBy([next])}
      personaLabel={personaLabel}
      scopeNote={scopeNote}
      kpis={kpis}
      callout={calloutRows}
      daily={daily}
      matrixResources={matrixResources}
      matrixGroups={matrixGroups}
      matrixCell={matrixCell}
      topConsumers={topConsumers}
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
