import { z } from "zod";

export const allocationStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DELETED"]);
export type AllocationStatus = z.infer<typeof allocationStatusSchema>;

export const projectStatusSchema = z.enum(["ACTIVE", "INACTIVE", "DELETED"]);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "MERGED"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

// MembershipStatus reuses the AllocationStatus enum on the backend
// (pkg/models/allocation.go: ComputeAllocationMembership.MembershipStatus).
export const membershipStatusSchema = allocationStatusSchema;
export type MembershipStatus = AllocationStatus;

export const changeRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export type ChangeRequestStatus = z.infer<typeof changeRequestStatusSchema>;

export const computeAllocationChangeRequestSchema = z.object({
  id: z.string(),
  compute_allocation_id: z.string(),
  requested_su_amount: z.number().int(),
  requested_status: allocationStatusSchema,
  reason: z.string(),
  change_status: changeRequestStatusSchema,
  requester_id: z.string(),
  approver_id: z.string().optional(),
  timestamp: z.string(),
});
export type ComputeAllocationChangeRequest = z.infer<typeof computeAllocationChangeRequestSchema>;

export const computeAllocationChangeRequestEventSchema = z.object({
  id: z.string(),
  compute_allocation_change_request_id: z.string(),
  event_type: z.string(),
  description: z.string().optional(),
  timestamp: z.string(),
});
export type ComputeAllocationChangeRequestEvent = z.infer<
  typeof computeAllocationChangeRequestEventSchema
>;

export const computeAllocationDiffSchema = z.object({
  id: z.string(),
  compute_allocation_id: z.string(),
  diff_type: z.string(),
  new_su_amount: z.number().int(),
  status: allocationStatusSchema,
  timestamp: z.string(),
  description: z.string().optional(),
});
export type ComputeAllocationDiff = z.infer<typeof computeAllocationDiffSchema>;
