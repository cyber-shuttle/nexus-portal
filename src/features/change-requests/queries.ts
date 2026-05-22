"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateChangeRequestPayload,
  type UpdateChangeRequestPayload,
  createChangeRequest,
  deleteChangeRequest,
  getChangeRequestEvents,
  getChangeRequestsForAllocation,
  getChangeRequestsForUser,
  updateChangeRequest,
} from "./api";

export const changeRequestKeys = {
  all: ["change-requests"] as const,
  forAllocation: (allocId: string) => [...changeRequestKeys.all, "allocation", allocId] as const,
  forUser: (userId: string) => [...changeRequestKeys.all, "user", userId] as const,
  events: (reqId: string) => [...changeRequestKeys.all, "events", reqId] as const,
};

export function useChangeRequestsForAllocation(allocId: string | undefined) {
  return useQuery({
    queryKey: allocId
      ? changeRequestKeys.forAllocation(allocId)
      : ["change-requests", "allocation", "none"],
    queryFn: () => getChangeRequestsForAllocation(allocId as string),
    enabled: Boolean(allocId),
  });
}

export function useChangeRequestsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? changeRequestKeys.forUser(userId) : ["change-requests", "user", "none"],
    queryFn: () => getChangeRequestsForUser(userId as string),
    enabled: Boolean(userId),
  });
}

export function useChangeRequestEvents(reqId: string | undefined) {
  return useQuery({
    queryKey: reqId ? changeRequestKeys.events(reqId) : ["change-requests", "events", "none"],
    queryFn: () => getChangeRequestEvents(reqId as string),
    enabled: Boolean(reqId),
  });
}

function invalidateChangeRequestRefs(
  client: ReturnType<typeof useQueryClient>,
  allocationId: string,
) {
  client.invalidateQueries({ queryKey: changeRequestKeys.all });
  client.invalidateQueries({ queryKey: ["audit", "allocation", allocationId] });
  client.invalidateQueries({ queryKey: ["admin", "change-requests"] });
}

export function useCreateChangeRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateChangeRequestPayload) => createChangeRequest(payload),
    onSuccess: (created) => invalidateChangeRequestRefs(client, created.compute_allocation_id),
  });
}

export function useApproveChangeRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approverId }: { id: string; approverId: string }) =>
      updateChangeRequest(id, { change_status: "APPROVED", approver_id: approverId }),
    onSuccess: (updated) => invalidateChangeRequestRefs(client, updated.compute_allocation_id),
  });
}

export function useDenyChangeRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approverId }: { id: string; approverId: string }) =>
      updateChangeRequest(id, { change_status: "REJECTED", approver_id: approverId }),
    onSuccess: (updated) => invalidateChangeRequestRefs(client, updated.compute_allocation_id),
  });
}

export function useUpdateChangeRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateChangeRequestPayload }) =>
      updateChangeRequest(id, patch),
    onSuccess: (updated) => invalidateChangeRequestRefs(client, updated.compute_allocation_id),
  });
}

export function useDeleteChangeRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; allocationId: string }) => deleteChangeRequest(id),
    onSuccess: (_, vars) => invalidateChangeRequestRefs(client, vars.allocationId),
  });
}
