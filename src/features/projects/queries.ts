"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { getProject, getProjectComputeAllocations, getProjectsAsPi } from "./api";

export const projectKeys = {
  all: ["projects"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
  asPi: (userId: string) => [...projectKeys.all, "as-pi", userId] as const,
  allocations: (projectId: string) =>
    [...projectKeys.all, "allocations", projectId] as const,
};

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? projectKeys.detail(projectId) : ["projects", "detail", "none"],
    queryFn: () => getProject(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useProjectsAsPi(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? projectKeys.asPi(userId) : ["projects", "as-pi", "none"],
    queryFn: () => getProjectsAsPi(userId as string),
    enabled: Boolean(userId),
  });
}

export function useProjectComputeAllocations(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId
      ? projectKeys.allocations(projectId)
      : ["projects", "allocations", "none"],
    queryFn: () => getProjectComputeAllocations(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useProjectsComputeAllocations(projectIds: string[]) {
  const queries = useQueries({
    queries: projectIds.map((id) => ({
      queryKey: projectKeys.allocations(id),
      queryFn: () => getProjectComputeAllocations(id),
      enabled: Boolean(id),
    })),
  });
  return queries;
}
