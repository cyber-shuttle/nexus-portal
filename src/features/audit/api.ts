import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type AuditEvent,
  type ComputeAllocationChangeRequest,
  type ComputeAllocationDiff,
  computeAllocationDiffSchema,
} from "./schemas";
import {
  getChangeRequestEvents,
  getChangeRequestsForAllocation,
} from "@features/change-requests/api";

export async function getAllocationDiffs(allocId: string): Promise<ComputeAllocationDiff[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/diffs`);
  return z.array(computeAllocationDiffSchema).parse(raw ?? []);
}

export function buildAuditTimeline(
  diffs: ComputeAllocationDiff[],
  requestsWithEvents: Array<{
    request: ComputeAllocationChangeRequest;
    events: Array<{
      id: string;
      compute_allocation_change_request_id: string;
      event_type: string;
      description?: string;
      timestamp: string;
    }>;
  }>,
): AuditEvent[] {
  const items: AuditEvent[] = [];
  for (const diff of diffs) {
    items.push({ kind: "diff", timestamp: diff.timestamp, data: diff });
  }
  for (const { request, events } of requestsWithEvents) {
    items.push({ kind: "change_request", timestamp: request.timestamp, data: request });
    for (const event of events) {
      items.push({
        kind: "change_request_event",
        timestamp: event.timestamp,
        data: event,
        request,
      });
    }
  }
  items.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  return items;
}

export async function getAllocationAuditTimeline(allocId: string): Promise<AuditEvent[]> {
  const [diffs, requests] = await Promise.all([
    getAllocationDiffs(allocId),
    getChangeRequestsForAllocation(allocId),
  ]);
  const requestsWithEvents = await Promise.all(
    requests.map(async (request) => ({
      request,
      events: await getChangeRequestEvents(request.id),
    })),
  );
  return buildAuditTimeline(diffs, requestsWithEvents);
}
