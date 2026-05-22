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
