"use client";

import { getProjectComputeAllocations } from "@features/projects/api";
import { getAllocationUsageTotal } from "@features/usage/api";
import type { ComputeAllocationUsageTotal } from "@features/usage/schemas";
import {
  NewProjectCta,
  type ProjectRow,
  ProjectsList,
} from "@features/projects/components/ProjectsList";
import {
  type DedupedProject,
  computeProjectRollup,
  dedupePiAndMemberProjects,
  emptyCopyFor,
  type Persona,
  tagAsPlain,
} from "@features/projects/list-helpers";
import {
  projectKeys,
  useProjects,
  useProjectsAsPi,
  useProjectsForUser,
} from "@features/projects/queries";
import type { Project, ProjectStatus } from "@features/projects/schemas";
import { useAbility } from "@shared/casl/AbilityProvider";
import { useQueries } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

// Cap the per-row fan-out — admin pages with hundreds of projects would
// otherwise spawn an N×2 query storm. Documented in
// docs/backend-contracts/projects.md §5 (fan-out cost).
const ROLLUP_FAN_OUT_CAP = 50;

type Props = {
  userId: string;
  persona: Persona;
};

function statusFilterFromUrl(raw: string | null): ProjectStatus | "all" {
  if (raw === "ACTIVE" || raw === "INACTIVE" || raw === "DELETED") return raw;
  return "all";
}

export function ProjectsListContainer({ userId, persona }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ability = useAbility();

  // URL-backed filter strip state so a reload preserves the cut.
  const search = searchParams.get("q") ?? "";
  const piFilter = searchParams.get("pi") ?? "";
  const orgFilter = searchParams.get("org") ?? "";
  const statusFilter = statusFilterFromUrl(searchParams.get("status"));

  const updateParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (!value) params.delete(key);
      else params.set(key, value);
      const next = params.toString();
      router.replace(next ? `?${next}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  // Persona-aware fetch composition. Each branch lists projects the user is
  // allowed to see; CASL's `read Project` rule already filters down to the
  // same set on the abilities side. Admin uses the paged list endpoint;
  // researcher uses the member-derived endpoint; PI takes the union.
  // Gate `useProjects` to admin only — researcher must never see the unscoped
  // catalog leak through (TF1 fix-up Fix 2).
  const adminQuery = useProjects(
    { limit: ROLLUP_FAN_OUT_CAP },
    { enabled: persona === "admin" },
  );
  const piOwnedQuery = useProjectsAsPi(persona === "pi" ? userId : undefined);
  const memberQuery = useProjectsForUser(
    persona === "researcher" || persona === "pi" ? userId : undefined,
  );

  const composed: DedupedProject[] = React.useMemo(() => {
    if (persona === "admin") return tagAsPlain(adminQuery.data?.items ?? []);
    if (persona === "pi") {
      return dedupePiAndMemberProjects(
        piOwnedQuery.data ?? [],
        memberQuery.data ?? [],
        userId,
      );
    }
    return tagAsPlain(memberQuery.data ?? []);
  }, [persona, adminQuery.data, piOwnedQuery.data, memberQuery.data, userId]);

  // Cap fan-out at 50 rows so the rollup KPIs don't melt admin's screen.
  const cappedProjects = composed.slice(0, ROLLUP_FAN_OUT_CAP);
  const projectIds = cappedProjects.map((row) => row.project.id);

  // Per-row allocations fan-out. Each project spawns one /compute-allocations
  // call; we then fan out one more level for per-allocation usage totals.
  const allocQueries = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: projectKeys.allocations(id),
      queryFn: () => getProjectComputeAllocations(id),
      enabled: Boolean(id),
    })),
  });

  // Flatten every allocation id we just fetched so usage queries can be fanned
  // out as one flat list. We re-bucket by project in the rollup pass below.
  const allocIdsByProject = React.useMemo(() => {
    return projectIds.map((id, i) => {
      const data = (allocQueries[i]?.data ?? []) as Array<{
        id: string;
        initial_su_amount: number;
      }>;
      return { projectId: id, allocations: data };
    });
  }, [projectIds, allocQueries]);

  const flatAllocIds = allocIdsByProject.flatMap((b) => b.allocations.map((a) => a.id));

  const usageQueries = useQueries({
    queries: flatAllocIds.map((allocId) => ({
      queryKey: ["usage", "total", allocId],
      queryFn: () => getAllocationUsageTotal(allocId),
      enabled: Boolean(allocId),
    })),
  });

  // Re-bucket usages back onto each project so the rollup helper can sum them.
  const usageByAllocId = React.useMemo(() => {
    const map = new Map<string, ComputeAllocationUsageTotal | undefined>();
    flatAllocIds.forEach((id, i) => {
      map.set(id, usageQueries[i]?.data as ComputeAllocationUsageTotal | undefined);
    });
    return map;
  }, [flatAllocIds, usageQueries]);

  const rows: ProjectRow[] = cappedProjects.map((row) => {
    const bucket = allocIdsByProject.find((b) => b.projectId === row.project.id);
    const allocations = bucket?.allocations ?? [];
    const usages = allocations.map((a) => usageByAllocId.get(a.id));
    const rollup = computeProjectRollup(allocations, usages);
    return {
      project: row.project,
      piLabel: null,
      allocationsCount: rollup.allocationsCount,
      totalSu: rollup.totalSu,
      usedSu: rollup.usedSu,
      usedPct: rollup.usedPct,
      membershipBadge: row.membershipBadge,
    };
  });

  const isLoading =
    (persona === "admin" && adminQuery.isLoading) ||
    (persona === "researcher" && memberQuery.isLoading) ||
    (persona === "pi" && (piOwnedQuery.isLoading || memberQuery.isLoading));
  const error =
    (adminQuery.error as Error | null) ??
    (piOwnedQuery.error as Error | null) ??
    (memberQuery.error as Error | null) ??
    null;

  const refetch = () => {
    if (persona === "admin") adminQuery.refetch();
    if (persona === "pi") piOwnedQuery.refetch();
    if (persona === "researcher" || persona === "pi") memberQuery.refetch();
  };

  const empty = emptyCopyFor(persona);
  const canCreate = ability.can("create", "Project");
  const emptyCopy = {
    heading: empty.heading,
    description: empty.description,
    cta: canCreate ? <NewProjectCta canCreate={canCreate} /> : undefined,
  };

  return (
    <ProjectsList
      rows={rows}
      isLoading={isLoading}
      error={error}
      onRetry={refetch}
      search={search}
      onSearchChange={(next) => updateParam("q", next)}
      statusFilter={statusFilter}
      onStatusFilterChange={(next) => updateParam("status", next === "all" ? null : next)}
      piFilter={piFilter}
      onPiFilterChange={(next) => updateParam("pi", next)}
      orgFilter={orgFilter}
      onOrgFilterChange={(next) => updateParam("org", next)}
      headerCta={<NewProjectCta canCreate={canCreate} />}
      emptyCopy={emptyCopy}
    />
  );
}

// Re-exported for the page server component — keeps the import path stable.
export type { Project };
