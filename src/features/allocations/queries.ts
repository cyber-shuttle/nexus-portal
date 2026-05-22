"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { getAllocation, getAllocationResources, getResourceRatesEffective } from "./api";

export const allocationKeys = {
  all: ["allocations"] as const,
  list: (params: Record<string, unknown> = {}) =>
    [...allocationKeys.all, "list", params] as const,
  detail: (id: string) => [...allocationKeys.all, "detail", id] as const,
  resources: (id: string) => [...allocationKeys.detail(id), "resources"] as const,
  resourceRate: (resourceId: string) =>
    [...allocationKeys.all, "resource-rate", resourceId] as const,
};

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
  const data = queries
    .map((q) => q.data)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
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
