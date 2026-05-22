"use client";

import * as React from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  computeAllocationSchema,
  projectSchema,
  type ComputeAllocation,
  type Project,
} from "@shared/api/domain";
import { useHomeSummary, type HomeSummaryResult } from "./useHomeSummary";
import type { PiHomeSummary } from "@features/home/types";

async function getProjectsForPi(userId: string): Promise<Project[]> {
  const raw = await apiFetch(`/users/${userId}/projects-as-pi`);
  return z.array(projectSchema).parse(raw ?? []);
}

async function getAllocationsForProject(projectId: string): Promise<ComputeAllocation[]> {
  const raw = await apiFetch(`/projects/${projectId}/compute-allocations`);
  return z.array(computeAllocationSchema).parse(raw ?? []);
}

export type PiHomeResult = Omit<HomeSummaryResult, "data"> & {
  data: PiHomeSummary | undefined;
};

export function usePiHomeSummary(userId: string | undefined): PiHomeResult {
  const base = useHomeSummary(userId);

  const projectsQuery = useQuery({
    queryKey: ["home", "pi-projects", userId ?? "none"],
    queryFn: () => getProjectsForPi(userId as string),
    enabled: Boolean(userId),
  });
  const projects = projectsQuery.data ?? [];

  const projectAllocationsQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ["home", "pi-project-allocations", p.id],
      queryFn: () => getAllocationsForProject(p.id),
      enabled: true,
    })),
  });

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
  }, [projects, projectAllocationsQueries, base.usedByAllocation, base.data?.pending_change_requests]);

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
