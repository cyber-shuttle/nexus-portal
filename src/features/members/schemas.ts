import { z } from "zod";
import {
  membershipStatusSchema,
  userStatusSchema,
  type MembershipStatus,
  type UserStatus,
} from "@shared/api/domain";

export { membershipStatusSchema, userStatusSchema };
export type { MembershipStatus, UserStatus };

export const userSchema = z.object({
  id: z.string(),
  organization_id: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  middle_name: z.string().optional(),
  email: z.string(),
  status: userStatusSchema,
});

export const userIdentitySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  source: z.string(),
  external_id: z.string(),
  email: z.string().optional(),
  oidc_sub: z.string().optional(),
  metadata: z.string().optional(),
  created_at: z.string(),
});

export const computeAllocationMembershipSchema = z.object({
  id: z.string(),
  compute_allocation_id: z.string(),
  user_id: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  membership_status: membershipStatusSchema,
});

export const computeAllocationMembershipResourceOverrideSchema = z.object({
  id: z.string(),
  compute_allocation_membership_id: z.string(),
  compute_allocation_resource_id: z.string(),
  override_resource_amount: z.number().int(),
  override_resource_time: z.number().int(),
});

export type User = z.infer<typeof userSchema>;
export type UserIdentity = z.infer<typeof userIdentitySchema>;
export type ComputeAllocationMembership = z.infer<typeof computeAllocationMembershipSchema>;
export type ComputeAllocationMembershipResourceOverride = z.infer<
  typeof computeAllocationMembershipResourceOverrideSchema
>;
