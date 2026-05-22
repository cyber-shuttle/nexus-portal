"use client";

import type { PiHomeSummary } from "@features/home/types";
import { useProjectsAsPi, useProjectsComputeAllocations } from "@features/projects/queries";
import * as React from "react";
import { type HomeSummaryResult, useHomeSummary } from "./useHomeSummary";

export type PiHomeResult = Omit<HomeSummaryResult, "data"> & {
  data: PiHomeSummary | undefined;
};

export function usePiHomeSummary(userId: string | undefined): PiHomeResult {
  const base = useHomeSummary(userId);

  const projectsQuery = useProjectsAsPi(userId);
  const projects = projectsQuery.data ?? [];

  const projectAllocationsQueries = useProjectsComputeAllocations(projects.map((p) => p.id));

  const projectRows = React.useMemo(() => {
    return projects.map((project, i) => {
      const allocations = projectAllocationsQueries[i]?.data ?? [];
      const total_su = allocations.reduce((acc, a) => acc + a.initial_su_amount, 0);
      const used_su = allocations.reduce(
        (acc, a) => acc + (base.usedByAllocation.get(a.id) ?? 0),
        0,
      );
      const pending_cr_count = (base.data?.pending_change_requests ?? []).filter((cr) =>
        allocations.some((a) => a.id === cr.compute_allocation_id),
      ).length;
      return {
        project,
        allocation_count: allocations.length,
        total_su,
        used_su,
        pending_cr_count,
      };
    });
  }, [
    projects,
    projectAllocationsQueries,
    base.usedByAllocation,
    base.data?.pending_change_requests,
  ]);

  const data = React.useMemo<PiHomeSummary | undefined>(() => {
    if (!base.data) return undefined;
    return {
      ...base.data,
      projects: projectRows,
    };
  }, [base.data, projectRows]);

  const isLoading = base.isLoading || projectsQuery.isLoading;
  const error = base.error ?? (projectsQuery.error as Error | null);

  return { data, usedByAllocation: base.usedByAllocation, isLoading, error };
}
