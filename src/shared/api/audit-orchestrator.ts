import type {
  ComputeAllocationChangeRequest,
  ComputeAllocationChangeRequestEvent,
  ComputeAllocationDiff,
} from "./domain";

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

export type RequestWithEvents = {
  request: ComputeAllocationChangeRequest;
  events: ComputeAllocationChangeRequestEvent[];
};

export function buildAuditTimeline(
  diffs: ComputeAllocationDiff[],
  requestsWithEvents: RequestWithEvents[],
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
