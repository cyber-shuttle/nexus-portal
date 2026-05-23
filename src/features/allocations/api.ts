import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type Cluster,
  type ClusterStatus,
  type ComputeAllocation,
  type ComputeAllocationResource,
  type ComputeAllocationResourceRate,
  type UpdateClusterStatusPayload,
  clusterSchema,
  computeAllocationResourceRateSchema,
  computeAllocationResourceSchema,
  computeAllocationSchema,
  updateClusterStatusPayloadSchema,
} from "./schemas";

export async function getAllocation(id: string): Promise<ComputeAllocation> {
  const raw = await apiFetch(`/compute-allocations/${id}`);
  return computeAllocationSchema.parse(raw);
}

export async function getAllocations(ids: string[]): Promise<ComputeAllocation[]> {
  const uniqueIds = Array.from(new Set(ids));
  return Promise.all(uniqueIds.map((id) => getAllocation(id)));
}

export async function getAllocationResources(
  allocId: string,
): Promise<ComputeAllocationResource[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/resources`);
  return z.array(computeAllocationResourceSchema).parse(raw ?? []);
}

export async function getResourceRatesEffective(
  resourceId: string,
): Promise<ComputeAllocationResourceRate> {
  const raw = await apiFetch(`/compute-allocation-resources/${resourceId}/rates/effective`);
  return computeAllocationResourceRateSchema.parse(raw);
}

// Cluster status endpoints — spec §8 B5/B6. The list endpoint can be filtered
// to `status=ENABLED` for selector consumers (see useEnabledClusters); the
// PATCH flips the status (admin only, gated via CASL `manage Cluster`).
export type ListClustersParams = { status?: ClusterStatus };

export async function listClusters(params: ListClustersParams = {}): Promise<Cluster[]> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  const qs = search.toString();
  const raw = await apiFetch(`/compute-clusters${qs ? `?${qs}` : ""}`);
  return z.array(clusterSchema).parse(raw ?? []);
}

export async function updateClusterStatus(id: string, status: ClusterStatus): Promise<Cluster> {
  const validated = updateClusterStatusPayloadSchema.parse({
    status,
  } satisfies UpdateClusterStatusPayload);
  const raw = await apiFetch(`/compute-clusters/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: validated,
  });
  return clusterSchema.parse(raw);
}
