import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type ComputeAllocationChangeRequest,
  type ComputeAllocationChangeRequestEvent,
  computeAllocationChangeRequestEventSchema,
  computeAllocationChangeRequestSchema,
} from "@shared/api/domain";

export async function getChangeRequestsForAllocation(
  allocId: string,
): Promise<ComputeAllocationChangeRequest[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/change-requests`);
  return z.array(computeAllocationChangeRequestSchema).parse(raw ?? []);
}

export async function getChangeRequestsForUser(
  userId: string,
): Promise<ComputeAllocationChangeRequest[]> {
  const raw = await apiFetch(`/users/${userId}/change-requests`);
  return z.array(computeAllocationChangeRequestSchema).parse(raw ?? []);
}

export async function getChangeRequestEvents(
  reqId: string,
): Promise<ComputeAllocationChangeRequestEvent[]> {
  const raw = await apiFetch(`/compute-allocation-change-requests/${reqId}/events`);
  return z.array(computeAllocationChangeRequestEventSchema).parse(raw ?? []);
}

export const createChangeRequestPayloadSchema = z.object({
  compute_allocation_id: z.string().min(1),
  requested_su_amount: z.number().int().nonnegative(),
  requested_status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]),
  reason: z.string().min(1),
  requester_id: z.string().min(1),
});
export type CreateChangeRequestPayload = z.infer<typeof createChangeRequestPayloadSchema>;

export const updateChangeRequestPayloadSchema = z
  .object({
    change_status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    approver_id: z.string().optional(),
    reason: z.string().optional(),
    requested_su_amount: z.number().int().nonnegative().optional(),
    requested_status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "patch is empty" });
export type UpdateChangeRequestPayload = z.infer<typeof updateChangeRequestPayloadSchema>;

export async function createChangeRequest(
  payload: CreateChangeRequestPayload,
): Promise<ComputeAllocationChangeRequest> {
  const parsed = createChangeRequestPayloadSchema.parse(payload);
  const raw = await apiFetch("/compute-allocation-change-requests", {
    method: "POST",
    body: parsed,
  });
  return computeAllocationChangeRequestSchema.parse(raw);
}

export async function updateChangeRequest(
  id: string,
  patch: UpdateChangeRequestPayload,
): Promise<ComputeAllocationChangeRequest> {
  const parsed = updateChangeRequestPayloadSchema.parse(patch);
  const raw = await apiFetch(`/compute-allocation-change-requests/${id}`, {
    method: "PUT",
    body: parsed,
  });
  return computeAllocationChangeRequestSchema.parse(raw);
}

export async function deleteChangeRequest(id: string): Promise<void> {
  await apiFetch(`/compute-allocation-change-requests/${id}`, { method: "DELETE" });
}
