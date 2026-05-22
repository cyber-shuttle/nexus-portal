import { z } from "zod";
import { allocationStatusSchema } from "@features/allocations/schemas";

export const changeRequestStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const computeAllocationDiffSchema = z.object({
  id: z.string(),
  compute_allocation_id: z.string(),
  diff_type: z.string(),
  new_su_amount: z.number().int(),
  status: allocationStatusSchema,
  timestamp: z.string(),
  description: z.string().optional(),
});

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

export const computeAllocationChangeRequestEventSchema = z.object({
  id: z.string(),
  compute_allocation_change_request_id: z.string(),
  event_type: z.string(),
  description: z.string().optional(),
  timestamp: z.string(),
});

export type ChangeRequestStatus = z.infer<typeof changeRequestStatusSchema>;
export type ComputeAllocationDiff = z.infer<typeof computeAllocationDiffSchema>;
export type ComputeAllocationChangeRequest = z.infer<typeof computeAllocationChangeRequestSchema>;
export type ComputeAllocationChangeRequestEvent = z.infer<
  typeof computeAllocationChangeRequestEventSchema
>;

export type AuditEventKind = "diff" | "change_request" | "change_request_event";

export type AuditEvent =
  | { kind: "diff"; timestamp: string; data: ComputeAllocationDiff }
  | { kind: "change_request"; timestamp: string; data: ComputeAllocationChangeRequest }
  | {
      kind: "change_request_event";
      timestamp: string;
      data: ComputeAllocationChangeRequestEvent;
      request: ComputeAllocationChangeRequest;
    };
