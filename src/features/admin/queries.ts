"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AdjustmentsParams,
  type AdminAllocationsFullParams,
  type AdminAllocationsParams,
  type AdminChangeRequestsParams,
  type AdminResourcesParams,
  createAdjustment,
  createAdminRate,
  deactivateAdminRate,
  discardUnmappedJob,
  getAdjustments,
  getAdminAllocations,
  getAdminAllocationsFull,
  getAdminChangeRequests,
  getAdminProjectsFull,
  getAdminRates,
  getAdminResources,
  getAdminResourceTrend,
  getAdminStats,
  getUnmappedJobs,
  linkUnmappedJob,
} from "./api";

export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  changeRequests: (params: AdminChangeRequestsParams = {}) =>
    [...adminKeys.all, "change-requests", params] as const,
  resources: (params: AdminResourcesParams = {}) =>
    [...adminKeys.all, "resources", params] as const,
  resourceTrend: (id: string) => [...adminKeys.all, "resources", "trend", id] as const,
  rates: () => [...adminKeys.all, "rates"] as const,
  allocationSummaries: (params: AdminAllocationsParams = {}) =>
    [...adminKeys.all, "allocations", params] as const,
  projectsFull: () => [...adminKeys.all, "projects-full"] as const,
  allocationsFull: (params: AdminAllocationsFullParams = {}) =>
    [...adminKeys.all, "allocations-full", params] as const,
  unmappedJobs: () => [...adminKeys.all, "unmapped-jobs"] as const,
  adjustments: (params: AdjustmentsParams = {}) =>
    [...adminKeys.all, "adjustments", params] as const,
};

export function useAdminStats() {
  return useQuery({
    queryKey: adminKeys.stats(),
    queryFn: getAdminStats,
  });
}

export function useAdminChangeRequests(params: AdminChangeRequestsParams = {}) {
  return useQuery({
    queryKey: adminKeys.changeRequests(params),
    queryFn: () => getAdminChangeRequests(params),
  });
}

export function useAdminResources(params: AdminResourcesParams = {}) {
  return useQuery({
    queryKey: adminKeys.resources(params),
    queryFn: () => getAdminResources(params),
  });
}

export function useAdminResourceTrend(id: string | undefined) {
  return useQuery({
    queryKey: id ? adminKeys.resourceTrend(id) : [...adminKeys.all, "resources", "trend", "none"],
    queryFn: () => getAdminResourceTrend(id as string),
    enabled: Boolean(id),
  });
}

export function useAdminRates() {
  return useQuery({
    queryKey: adminKeys.rates(),
    queryFn: getAdminRates,
  });
}

export function useCreateAdminRate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createAdminRate,
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.rates() }),
  });
}

export function useDeactivateAdminRate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateAdminRate(id),
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.rates() }),
  });
}

export function useAdminAllocations(params: AdminAllocationsParams = {}) {
  return useQuery({
    queryKey: adminKeys.allocationSummaries(params),
    queryFn: () => getAdminAllocations(params),
  });
}

// A3 site-wide enumerations for the admin analytics page.
export function useAdminProjectsFull() {
  return useQuery({
    queryKey: adminKeys.projectsFull(),
    queryFn: getAdminProjectsFull,
  });
}

export function useAdminAllocationsFull(params: AdminAllocationsFullParams = {}) {
  return useQuery({
    queryKey: adminKeys.allocationsFull(params),
    queryFn: () => getAdminAllocationsFull(params),
  });
}

export function useUnmappedJobs() {
  return useQuery({
    queryKey: adminKeys.unmappedJobs(),
    queryFn: getUnmappedJobs,
  });
}

export function useLinkUnmappedJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, allocation_id }: { id: string; allocation_id: string }) =>
      linkUnmappedJob(id, allocation_id),
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.unmappedJobs() }),
  });
}

export function useDiscardUnmappedJob() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => discardUnmappedJob(id, reason),
    onSuccess: () => client.invalidateQueries({ queryKey: adminKeys.unmappedJobs() }),
  });
}

export function useAdjustments(params: AdjustmentsParams = {}) {
  return useQuery({
    queryKey: adminKeys.adjustments(params),
    queryFn: () => getAdjustments(params),
  });
}

export function useCreateAdjustment() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createAdjustment,
    onSuccess: () => client.invalidateQueries({ queryKey: [...adminKeys.all, "adjustments"] }),
  });
}

// Cluster hooks (`useClusters`, `useEnabledClusters`, `useUpdateClusterStatus`)
// live in `@features/allocations/queries` per TF0 architect carry-over so
// selector consumers in `features/proposals` and `features/signer` can import
// them without crossing the §5 isolation rule.
