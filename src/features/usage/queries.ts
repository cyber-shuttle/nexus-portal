"use client";

import { useQuery } from "@tanstack/react-query";
import {
  type UsageListParams,
  getAllocationUsageTotal,
  getAllocationUsages,
  getAllocationUserUsageTotal,
} from "./api";

export const usageKeys = {
  all: ["usage"] as const,
  total: (allocId: string) => [...usageKeys.all, "total", allocId] as const,
  userTotal: (allocId: string, userId: string) =>
    [...usageKeys.all, "user-total", allocId, userId] as const,
  list: (allocId: string, params: UsageListParams) =>
    [...usageKeys.all, "list", allocId, params] as const,
};

export function useAllocationUsageTotal(allocId: string | undefined) {
  return useQuery({
    queryKey: allocId ? usageKeys.total(allocId) : ["usage", "total", "none"],
    queryFn: () => getAllocationUsageTotal(allocId as string),
    enabled: Boolean(allocId),
  });
}

export function useAllocationUserUsageTotal(
  allocId: string | undefined,
  userId: string | undefined,
) {
  return useQuery({
    queryKey:
      allocId && userId ? usageKeys.userTotal(allocId, userId) : ["usage", "user-total", "none"],
    queryFn: () => getAllocationUserUsageTotal(allocId as string, userId as string),
    enabled: Boolean(allocId && userId),
  });
}

export function useAllocationUsages(allocId: string | undefined, params: UsageListParams = {}) {
  return useQuery({
    queryKey: allocId ? usageKeys.list(allocId, params) : ["usage", "list", "none"],
    queryFn: () => getAllocationUsages(allocId as string, params),
    enabled: Boolean(allocId),
  });
}
