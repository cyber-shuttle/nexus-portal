"use client";

import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ListClustersParams,
  getAllocation,
  getAllocationResources,
  getResourceRatesEffective,
  listClusters,
  updateClusterStatus,
} from "./api";
import type { ClusterStatus } from "./schemas";

export const allocationKeys = {
  all: ["allocations"] as const,
  list: (params: Record<string, unknown> = {}) => [...allocationKeys.all, "list", params] as const,
  detail: (id: string) => [...allocationKeys.all, "detail", id] as const,
  resources: (id: string) => [...allocationKeys.detail(id), "resources"] as const,
  resourceRate: (resourceId: string) =>
    [...allocationKeys.all, "resource-rate", resourceId] as const,
};

// Cluster keys live under the allocations feature (TF0 architect carry-over)
// since clusters are an allocations-domain concept. Any feature outside admin
// that needs a cluster selector imports `useEnabledClusters` from here — never
// from `@features/admin` (§5 isolation rule).
export const clusterKeys = {
  all: ["clusters"] as const,
  list: (params: ListClustersParams = {}) => [...clusterKeys.all, "list", params] as const,
};

export function useClusters(params: ListClustersParams = {}) {
  return useQuery({
    queryKey: clusterKeys.list(params),
    queryFn: () => listClusters(params),
  });
}

// Single canonical source for "valid selector options" — see spec §5.4. Wire
// every cluster picker through this hook so a DISABLED cluster never appears
// in a new-allocation flow.
export function useEnabledClusters() {
  return useClusters({ status: "ENABLED" });
}

export function useUpdateClusterStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ClusterStatus }) =>
      updateClusterStatus(id, status),
    onSuccess: () => {
      // Every list variant (ENABLED-only, ALL, etc.) needs to refetch so the
      // toggle reflects immediately in selectors and the admin table.
      client.invalidateQueries({ queryKey: clusterKeys.all });
    },
  });
}

export function useAllocation(id: string | undefined) {
  return useQuery({
    queryKey: id ? allocationKeys.detail(id) : ["allocations", "detail", "none"],
    queryFn: () => getAllocation(id as string),
    enabled: Boolean(id),
  });
}

export function useAllocations(ids: string[]) {
  const queries = useQueries({
    queries: ids.map((id) => ({
      queryKey: allocationKeys.detail(id),
      queryFn: () => getAllocation(id),
      enabled: Boolean(id),
    })),
  });
  const data = queries.map((q) => q.data).filter((a): a is NonNullable<typeof a> => Boolean(a));
  return {
    data,
    isLoading: queries.some((q) => q.isLoading),
    error: (queries.find((q) => q.error)?.error as Error | undefined) ?? null,
  };
}

export function useAllocationResources(id: string | undefined) {
  return useQuery({
    queryKey: id ? allocationKeys.resources(id) : ["allocations", "resources", "none"],
    queryFn: () => getAllocationResources(id as string),
    enabled: Boolean(id),
  });
}

export function useResourceRatesEffective(resourceId: string | undefined) {
  return useQuery({
    queryKey: resourceId ? allocationKeys.resourceRate(resourceId) : ["resource-rate", "none"],
    queryFn: () => getResourceRatesEffective(resourceId as string),
    enabled: Boolean(resourceId),
  });
}
