import { apiFetch } from "@shared/api/client";
import {
  type ComputeAllocation,
  type ComputeAllocationResource,
  type ComputeAllocationResourceRate,
  computeAllocationResourceRateSchema,
  computeAllocationResourceSchema,
  computeAllocationSchema,
} from "./schemas";
import {
  type ComputeAllocationMembership,
  computeAllocationMembershipSchema,
} from "@features/members/schemas";
import { z } from "zod";

export async function getAllocation(id: string): Promise<ComputeAllocation> {
  const raw = await apiFetch(`/compute-allocations/${id}`);
  return computeAllocationSchema.parse(raw);
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

export async function getMembershipsForUser(
  userId: string,
): Promise<ComputeAllocationMembership[]> {
  const raw = await apiFetch(`/users/${userId}/compute-allocation-memberships`);
  return z.array(computeAllocationMembershipSchema).parse(raw ?? []);
}

export async function getAllocationsForUser(userId: string): Promise<ComputeAllocation[]> {
  const memberships = await getMembershipsForUser(userId);
  const uniqueIds = Array.from(new Set(memberships.map((m) => m.compute_allocation_id)));
  const allocations = await Promise.all(uniqueIds.map((id) => getAllocation(id)));
  return allocations;
}
