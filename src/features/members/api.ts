import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type ComputeAllocationMembership,
  type ComputeAllocationMembershipResourceOverride,
  type User,
  type UserIdentity,
  computeAllocationMembershipResourceOverrideSchema,
  computeAllocationMembershipSchema,
  userIdentitySchema,
  userSchema,
} from "./schemas";

export async function getMembershipsForAllocation(
  allocId: string,
): Promise<ComputeAllocationMembership[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/memberships`);
  return z.array(computeAllocationMembershipSchema).parse(raw ?? []);
}

export async function getMembershipsForUser(
  userId: string,
): Promise<ComputeAllocationMembership[]> {
  const raw = await apiFetch(`/users/${userId}/compute-allocation-memberships`);
  return z.array(computeAllocationMembershipSchema).parse(raw ?? []);
}

export async function getMembershipOverrides(
  membershipId: string,
): Promise<ComputeAllocationMembershipResourceOverride[]> {
  const raw = await apiFetch(
    `/compute-allocation-memberships/${membershipId}/resource-overrides`,
  );
  return z.array(computeAllocationMembershipResourceOverrideSchema).parse(raw ?? []);
}

export async function getUserById(id: string): Promise<User> {
  const raw = await apiFetch(`/users/${id}`);
  return userSchema.parse(raw);
}

export async function getUserIdentities(userId: string): Promise<UserIdentity[]> {
  const raw = await apiFetch(`/users/${userId}/user-identities`);
  return z.array(userIdentitySchema).parse(raw ?? []);
}

export async function searchUsers(query: string, limit = 20): Promise<User[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  const raw = await apiFetch(`/users?${params.toString()}`);
  return z.array(userSchema).parse(raw ?? []);
}

export const createMembershipPayloadSchema = z.object({
  compute_allocation_id: z.string().min(1),
  user_id: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  membership_status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).default("ACTIVE"),
});
export type CreateMembershipPayload = z.input<typeof createMembershipPayloadSchema>;

export const updateMembershipPayloadSchema = z
  .object({
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    membership_status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "patch is empty" });
export type UpdateMembershipPayload = z.infer<typeof updateMembershipPayloadSchema>;

export async function createMembership(
  payload: CreateMembershipPayload,
): Promise<ComputeAllocationMembership> {
  const parsed = createMembershipPayloadSchema.parse(payload);
  const raw = await apiFetch("/compute-allocation-memberships", {
    method: "POST",
    body: parsed,
  });
  return computeAllocationMembershipSchema.parse(raw);
}

export async function updateMembership(
  id: string,
  patch: UpdateMembershipPayload,
): Promise<ComputeAllocationMembership> {
  const parsed = updateMembershipPayloadSchema.parse(patch);
  const raw = await apiFetch(`/compute-allocation-memberships/${id}`, {
    method: "PUT",
    body: parsed,
  });
  return computeAllocationMembershipSchema.parse(raw);
}

export async function setMembershipStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE" | "DELETED",
): Promise<ComputeAllocationMembership> {
  const raw = await apiFetch(`/compute-allocation-memberships/${id}/status`, {
    method: "PUT",
    body: { membership_status: status },
  });
  return computeAllocationMembershipSchema.parse(raw);
}

export async function deleteMembership(id: string): Promise<void> {
  await apiFetch(`/compute-allocation-memberships/${id}`, { method: "DELETE" });
}

export const overridePayloadSchema = z.object({
  compute_allocation_membership_id: z.string().min(1),
  compute_allocation_resource_id: z.string().min(1),
  override_resource_amount: z.number().int().nonnegative(),
  override_resource_time: z.number().int().nonnegative(),
});
export type OverridePayload = z.infer<typeof overridePayloadSchema>;

export async function createMembershipOverride(
  payload: OverridePayload,
): Promise<ComputeAllocationMembershipResourceOverride> {
  const parsed = overridePayloadSchema.parse(payload);
  const raw = await apiFetch("/compute-allocation-membership-resource-overrides", {
    method: "POST",
    body: parsed,
  });
  return computeAllocationMembershipResourceOverrideSchema.parse(raw);
}

export async function updateMembershipOverride(
  id: string,
  patch: Partial<OverridePayload>,
): Promise<ComputeAllocationMembershipResourceOverride> {
  const raw = await apiFetch(`/compute-allocation-membership-resource-overrides/${id}`, {
    method: "PUT",
    body: patch,
  });
  return computeAllocationMembershipResourceOverrideSchema.parse(raw);
}

export async function deleteMembershipOverride(id: string): Promise<void> {
  await apiFetch(`/compute-allocation-membership-resource-overrides/${id}`, {
    method: "DELETE",
  });
}
