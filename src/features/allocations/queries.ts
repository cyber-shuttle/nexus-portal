"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getAllocation,
  getAllocationResources,
  getAllocationsForUser,
  getProject,
  getResourceRatesEffective,
} from "./api";

export const allocationKeys = {
  all: ["allocations"] as const,
  list: (params: Record<string, unknown> = {}) =>
    [...allocationKeys.all, "list", params] as const,
  detail: (id: string) => [...allocationKeys.all, "detail", id] as const,
  resources: (id: string) => [...allocationKeys.detail(id), "resources"] as const,
  resourceRate: (resourceId: string) =>
    ["compute-allocation-resources", resourceId, "rates", "effective"] as const,
  forUser: (userId: string) => [...allocationKeys.all, "for-user", userId] as const,
  project: (projectId: string) => ["projects", projectId] as const,
};

export function useAllocation(id: string | undefined) {
  return useQuery({
    queryKey: id ? allocationKeys.detail(id) : ["allocations", "detail", "none"],
    queryFn: () => getAllocation(id as string),
    enabled: Boolean(id),
  });
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

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? allocationKeys.project(projectId) : ["projects", "none"],
    queryFn: () => getProject(projectId as string),
    enabled: Boolean(projectId),
  });
}

export function useAllocationsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? allocationKeys.forUser(userId) : ["allocations", "for-user", "none"],
    queryFn: () => getAllocationsForUser(userId as string),
    enabled: Boolean(userId),
  });
}
