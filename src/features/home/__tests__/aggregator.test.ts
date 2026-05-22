import { describe, expect, it } from "vitest";
import {
  aggregateHomeSummary,
  buildRecentActivity,
  classifyAllocations,
  computeUsage30d,
  pendingChangeRequests,
} from "../aggregator";
import type {
  ComputeAllocation,
  ComputeAllocationChangeRequest,
  ComputeAllocationDiff,
} from "@shared/api/domain";

const NOW = Date.parse("2026-05-01T00:00:00Z");
const day = 24 * 60 * 60 * 1000;

function makeAllocation(overrides: Partial<ComputeAllocation> = {}): ComputeAllocation {
  return {
    id: "alloc-1",
    project_id: "proj-1",
    name: "alloc-1",
    status: "ACTIVE",
    compute_cluster_id: "cluster-1",
    initial_su_amount: 1000,
    start_time: new Date(NOW - 90 * day).toISOString(),
    end_time: new Date(NOW + 60 * day).toISOString(),
    ...overrides,
  };
}

describe("classifyAllocations", () => {
  it("only counts ACTIVE allocations and flags expiring/recently-active", () => {
    const active = makeAllocation();
    const expiring = makeAllocation({
      id: "alloc-2",
      end_time: new Date(NOW + 15 * day).toISOString(),
    });
    const inactive = makeAllocation({ id: "alloc-3", status: "INACTIVE" });
    const result = classifyAllocations(
      [active, expiring, inactive],
      new Map([["alloc-1", [{ timestamp: new Date(NOW - 2 * day).toISOString() }]]]),
      NOW,
    );
    expect(result.active.map((a) => a.id)).toEqual(["alloc-1", "alloc-2"]);
    expect(result.expiring_soon.map((a) => a.id)).toEqual(["alloc-2"]);
    expect(result.recently_active.map((a) => a.id)).toEqual(["alloc-1"]);
  });

  it("treats expired allocations as not expiring soon", () => {
    const expired = makeAllocation({
      id: "alloc-expired",
      end_time: new Date(NOW - 1 * day).toISOString(),
    });
    const result = classifyAllocations([expired], new Map(), NOW);
    expect(result.expiring_soon).toEqual([]);
  });
});

describe("computeUsage30d", () => {
  it("sums usage within the last 30 days and groups by resource", () => {
    const result = computeUsage30d(
      [
        {
          compute_allocation_resource_id: "res-1",
          used_su_amount: 100,
          last_updated: new Date(NOW - 1 * day).toISOString(),
        },
        {
          compute_allocation_resource_id: "res-1",
          used_su_amount: 200,
          last_updated: new Date(NOW - 10 * day).toISOString(),
        },
        {
          compute_allocation_resource_id: "res-2",
          used_su_amount: 50,
          last_updated: new Date(NOW - 2 * day).toISOString(),
        },
        {
          compute_allocation_resource_id: "res-1",
          used_su_amount: 9999,
          last_updated: new Date(NOW - 45 * day).toISOString(),
        },
      ],
      NOW,
    );
    expect(result.last_30d_su).toBe(350);
    expect(result.last_30d_breakdown).toEqual([
      { resource_id: "res-1", su: 300 },
      { resource_id: "res-2", su: 50 },
    ]);
  });
});

describe("pendingChangeRequests", () => {
  it("filters to PENDING status", () => {
    const requests: ComputeAllocationChangeRequest[] = [
      {
        id: "cr-1",
        compute_allocation_id: "alloc-1",
        requested_su_amount: 100,
        requested_status: "ACTIVE",
        reason: "x",
        change_status: "PENDING",
        requester_id: "u-1",
        timestamp: new Date(NOW - day).toISOString(),
      },
      {
        id: "cr-2",
        compute_allocation_id: "alloc-1",
        requested_su_amount: 200,
        requested_status: "ACTIVE",
        reason: "y",
        change_status: "APPROVED",
        requester_id: "u-1",
        timestamp: new Date(NOW - day).toISOString(),
      },
    ];
    expect(pendingChangeRequests(requests).map((r) => r.id)).toEqual(["cr-1"]);
  });
});

describe("buildRecentActivity", () => {
  it("merges diffs and change requests sorted desc and capped at limit", () => {
    const diffs: ComputeAllocationDiff[] = Array.from({ length: 15 }).map((_, i) => ({
      id: `d-${i}`,
      compute_allocation_id: "alloc-1",
      diff_type: "USAGE_UPDATE",
      new_su_amount: i,
      status: "ACTIVE",
      timestamp: new Date(NOW - i * 3600_000).toISOString(),
    }));
    const requests: ComputeAllocationChangeRequest[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `cr-${i}`,
      compute_allocation_id: "alloc-1",
      requested_su_amount: 100,
      requested_status: "ACTIVE",
      reason: "x",
      change_status: "PENDING",
      requester_id: "u-1",
      timestamp: new Date(NOW - (i + 1) * 7200_000).toISOString(),
    }));
    const events = buildRecentActivity({ diffs, changeRequests: requests }, 20);
    expect(events.length).toBe(20);
    for (let i = 1; i < events.length; i += 1) {
      const prev = events[i - 1];
      const curr = events[i];
      if (prev && curr) {
        expect(prev.timestamp >= curr.timestamp).toBe(true);
      }
    }
  });
});

describe("aggregateHomeSummary", () => {
  it("composes the full summary", () => {
    const allocation = makeAllocation();
    const summary = aggregateHomeSummary(
      {
        allocations: [allocation],
        usagesByAllocation: new Map([
          [
            allocation.id,
            [
              {
                compute_allocation_id: allocation.id,
                compute_allocation_resource_id: "res-1",
                used_su_amount: 42,
                last_updated: new Date(NOW - 3 * day).toISOString(),
              },
            ],
          ],
        ]),
        diffs: [],
        changeRequests: [],
      },
      NOW,
    );
    expect(summary.allocations.active).toHaveLength(1);
    expect(summary.usage.last_30d_su).toBe(42);
    expect(summary.usage.last_30d_breakdown).toEqual([{ resource_id: "res-1", su: 42 }]);
    expect(summary.pending_change_requests).toEqual([]);
    expect(summary.recent_activity).toEqual([]);
  });
});
