import { describe, expect, it } from "vitest";
import { buildAuditTimeline } from "../api";
import type {
  ComputeAllocationChangeRequest,
  ComputeAllocationChangeRequestEvent,
  ComputeAllocationDiff,
} from "../schemas";

const diff: ComputeAllocationDiff = {
  id: "diff-1",
  compute_allocation_id: "alloc-1",
  diff_type: "USAGE_UPDATE",
  new_su_amount: 5000,
  status: "ACTIVE",
  timestamp: "2026-04-01T00:00:00Z",
  description: "Usage updated",
};

const request: ComputeAllocationChangeRequest = {
  id: "cr-1",
  compute_allocation_id: "alloc-1",
  requested_su_amount: 10000,
  requested_status: "ACTIVE",
  reason: "Need more",
  change_status: "APPROVED",
  requester_id: "user-1",
  approver_id: "admin-1",
  timestamp: "2026-03-15T00:00:00Z",
};

const event: ComputeAllocationChangeRequestEvent = {
  id: "ev-1",
  compute_allocation_change_request_id: "cr-1",
  event_type: "APPROVED",
  description: "Approved by admin",
  timestamp: "2026-03-20T00:00:00Z",
};

describe("buildAuditTimeline", () => {
  it("merges diffs and change-request events sorted desc", () => {
    const timeline = buildAuditTimeline([diff], [{ request, events: [event] }]);
    expect(timeline).toHaveLength(3);
    expect(timeline.map((t) => t.kind)).toEqual([
      "diff",
      "change_request_event",
      "change_request",
    ]);
  });

  it("handles empty inputs", () => {
    expect(buildAuditTimeline([], [])).toEqual([]);
  });

  it("keeps events stably ordered by timestamp descending", () => {
    const olderDiff: ComputeAllocationDiff = { ...diff, id: "diff-2", timestamp: "2026-01-01T00:00:00Z" };
    const timeline = buildAuditTimeline([diff, olderDiff], []);
    expect(timeline[0]?.timestamp).toBe(diff.timestamp);
    expect(timeline[1]?.timestamp).toBe(olderDiff.timestamp);
  });
});
