"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ListProjectsParams,
  type ProjectUsageRange,
  createProject,
  getProject,
  getProjectComputeAllocations,
  getProjectUsageSummary,
  getProjectsAsPi,
  getProjectsForUser,
  listProjects,
  searchProjects,
  updateProjectStatus,
} from "./api";
import type { CreateProjectPayload, UpdateProjectStatusPayload } from "./schemas";

export const projectKeys = {
  all: ["projects"] as const,
  list: (params: ListProjectsParams = {}) => [...projectKeys.all, "list", params] as const,
  forUser: (userId: string) => [...projectKeys.all, "for-user", userId] as const,
  usageSummary: (id: string, range: ProjectUsageRange) =>
    [...projectKeys.all, "usage-summary", id, range] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
  asPi: (userId: string) => [...projectKeys.all, "as-pi", userId] as const,
  allocations: (projectId: string) => [...projectKeys.all, "allocations", projectId] as const,
  search: (q: string) => [...projectKeys.all, "search", q] as const,
};

export function useProjectSearch(q: string) {
  return useQuery({
    queryKey: projectKeys.search(q),
    queryFn: () => searchProjects(q),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
}

export function useProjects(params: ListProjectsParams = {}) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => listProjects(params),
  });
}

export function useProjectsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? projectKeys.forUser(userId) : [...projectKeys.all, "for-user", "none"],
    queryFn: () => getProjectsForUser(userId as string),
    enabled: Boolean(userId),
  });
}

export function useProjectUsageSummary(id: string | undefined, range: ProjectUsageRange) {
  return useQuery({
    queryKey: id
      ? projectKeys.usageSummary(id, range)
      : [...projectKeys.all, "usage-summary", "none"],
    queryFn: () => getProjectUsageSummary(id as string, range),
    enabled: Boolean(id),
  });
}

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
    queryKey: projectId ? projectKeys.allocations(projectId) : ["projects", "allocations", "none"],
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

// CASL-gated mutations. Callers are expected to wrap CTAs in <Can> so this
// hook is never invoked from a UI surface the user can't reach. The hook
// itself stays role-agnostic — gating belongs at the call site.
export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => client.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateProjectStatusPayload }) =>
      updateProjectStatus(id, payload),
    onSuccess: (project) => {
      client.invalidateQueries({ queryKey: projectKeys.all });
      client.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
    },
  });
}
