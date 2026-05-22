import { apiFetch } from "@shared/api/client";
import {
  type ComputeAllocation,
  type ComputeAllocationResource,
  type ComputeAllocationResourceRate,
  type Project,
  computeAllocationResourceRateSchema,
  computeAllocationResourceSchema,
  computeAllocationSchema,
  projectSchema,
} from "./schemas";
import { z } from "zod";

export async function getAllocation(id: string): Promise<ComputeAllocation> {
  const raw = await apiFetch(`/compute-allocations/${id}`);
  return computeAllocationSchema.parse(raw);
}

export async function getAllocations(ids: string[]): Promise<ComputeAllocation[]> {
  const uniqueIds = Array.from(new Set(ids));
  return Promise.all(uniqueIds.map((id) => getAllocation(id)));
}

export async function getAllocationResources(allocId: string): Promise<ComputeAllocationResource[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/resources`);
  return z.array(computeAllocationResourceSchema).parse(raw ?? []);
}

export async function getResourceRatesEffective(
  resourceId: string,
): Promise<ComputeAllocationResourceRate> {
  const raw = await apiFetch(`/compute-allocation-resources/${resourceId}/rates/effective`);
  return computeAllocationResourceRateSchema.parse(raw);
}

export async function getProject(id: string): Promise<Project> {
  const raw = await apiFetch(`/projects/${id}`);
  return projectSchema.parse(raw);
}
