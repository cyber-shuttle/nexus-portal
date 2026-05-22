import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type ComputeAllocationChangeRequest,
  type ComputeAllocationChangeRequestEvent,
  computeAllocationChangeRequestEventSchema,
  computeAllocationChangeRequestSchema,
} from "./schemas";

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
