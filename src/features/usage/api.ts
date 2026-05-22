import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type ComputeAllocationUsage,
  type ComputeAllocationUsageTotal,
  type ComputeAllocationUserUsageTotal,
  computeAllocationUsageSchema,
  computeAllocationUsageTotalSchema,
  computeAllocationUserUsageTotalSchema,
} from "./schemas";

export async function getAllocationUsageTotal(
  allocId: string,
): Promise<ComputeAllocationUsageTotal> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/usages/total`);
  return computeAllocationUsageTotalSchema.parse(raw);
}

export async function getAllocationUserUsageTotal(
  allocId: string,
  userId: string,
): Promise<ComputeAllocationUserUsageTotal> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/users/${userId}/usages/total`);
  return computeAllocationUserUsageTotalSchema.parse(raw);
}

export type UsageListParams = {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
};

function buildQuery(params: UsageListParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function getAllocationUsages(
  allocId: string,
  params: UsageListParams = {},
): Promise<ComputeAllocationUsage[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/usages${buildQuery(params)}`);
  return z.array(computeAllocationUsageSchema).parse(raw ?? []);
}
