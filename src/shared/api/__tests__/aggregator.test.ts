import type {
  ComputeAllocation,
  ComputeAllocationChangeRequest,
  ComputeAllocationDiff,
} from "@shared/api/domain";
import { describe, expect, it } from "vitest";
import {
  aggregateHomeSummary,
  bandForUsageRatio,
  buildRecentActivity,
  classifyAllocations,
  complianceMatrix,
  computeUsage30d,
  forecast,
  pace,
  pendingChangeRequests,
  topN,
} from "../aggregator";

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

describe("pace", () => {
  const allocation = {
    initial_su_amount: 1000,
    start_time: new Date(NOW - 50 * day).toISOString(),
    end_time: new Date(NOW + 50 * day).toISOString(),
  };

  it("returns on-pace when burn ratio matches expected elapsed ratio", () => {
    const usages = [{ used_su_amount: 500, last_updated: new Date(NOW - 1 * day).toISOString() }];
    const result = pace(allocation, usages, NOW);
    expect(result.status).toBe("on-pace");
    expect(result.burn).toBeCloseTo(0.5, 5);
    expect(result.expected).toBeCloseTo(0.5, 5);
  });

  it("returns over when used outruns elapsed by more than tolerance", () => {
    const usages = [{ used_su_amount: 900, last_updated: new Date(NOW - 1 * day).toISOString() }];
    expect(pace(allocation, usages, NOW).status).toBe("over");
  });

  it("returns under when used trails elapsed by more than tolerance", () => {
    const usages = [{ used_su_amount: 100, last_updated: new Date(NOW - 1 * day).toISOString() }];
    expect(pace(allocation, usages, NOW).status).toBe("under");
  });

  it("handles empty usages as under", () => {
    expect(pace(allocation, [], NOW).status).toBe("under");
  });
});

describe("forecast", () => {
  const allocation = {
    initial_su_amount: 1000,
    start_time: new Date(NOW - 90 * day).toISOString(),
    end_time: new Date(NOW + 90 * day).toISOString(),
  };

  it("flags insufficient-data when fewer than 7 distinct days of usages exist", () => {
    const usages = [
      { used_su_amount: 50, last_updated: new Date(NOW - 1 * day).toISOString() },
      { used_su_amount: 50, last_updated: new Date(NOW - 2 * day).toISOString() },
    ];
    const result = forecast(usages, allocation, NOW);
    expect(result.exhaustDate).toBeNull();
    expect(result.daysRemaining).toBeNull();
    expect(result.method).toBe("insufficient-data");
  });

  it("projects exhaust from rolling-7d slope when window is full", () => {
    const usages = Array.from({ length: 7 }).map((_, i) => ({
      used_su_amount: 50,
      last_updated: new Date(NOW - (i + 1) * day).toISOString(),
    }));
    const result = forecast(usages, allocation, NOW);
    expect(result.daysRemaining).not.toBeNull();
    expect(result.exhaustDate).toBeInstanceOf(Date);
    expect(result.daysRemaining as number).toBeCloseTo((1000 - 350) / 50, 5);
    expect(result.method).toBe("rolling-7d");
  });

  it("flags insufficient-data when 7-day slope is zero", () => {
    const usages = Array.from({ length: 7 }).map((_, i) => ({
      used_su_amount: 0,
      last_updated: new Date(NOW - (i + 1) * day).toISOString(),
    }));
    const result = forecast(usages, allocation, NOW);
    expect(result.exhaustDate).toBeNull();
    expect(result.method).toBe("insufficient-data");
  });
});

describe("topN", () => {
  it("returns the input unchanged when items are at-or-below N", () => {
    const items = [{ k: "a", v: 1 }];
    expect(topN(items, (i) => i.v, 5)).toEqual(items);
  });

  it("aggregates the tail via the provided reducer", () => {
    const items = [
      { k: "a", v: 10 },
      { k: "b", v: 6 },
      { k: "c", v: 4 },
      { k: "d", v: 3 },
    ];
    const result = topN(
      items,
      (i) => i.v,
      2,
      "Other",
      (acc, item) => ({ k: acc.k, v: acc.v + item.v }),
    );
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.v)).toEqual([10, 6, 7]);
  });

  it("uses makeOther factory when supplied", () => {
    const items = [
      { k: "a", v: 5 },
      { k: "b", v: 3 },
      { k: "c", v: 1 },
    ];
    const result = topN(items, (i) => i.v, 1, "Other", undefined, (rest, label) => ({
      k: label,
      v: rest.reduce((acc, x) => acc + x.v, 0),
    }));
    expect(result).toEqual([
      { k: "a", v: 5 },
      { k: "Other", v: 4 },
    ]);
  });

  it("handles empty input", () => {
    expect(topN<{ v: number }>([], (i) => i.v, 5)).toEqual([]);
  });
});

describe("bandForUsageRatio", () => {
  it("maps thresholds to bands matching UsageBar", () => {
    expect(bandForUsageRatio(0)).toBe("empty");
    expect(bandForUsageRatio(0.005)).toBe("empty");
    expect(bandForUsageRatio(0.5)).toBe("ok");
    expect(bandForUsageRatio(0.75)).toBe("warn");
    expect(bandForUsageRatio(0.89)).toBe("warn");
    expect(bandForUsageRatio(0.9)).toBe("hot");
    expect(bandForUsageRatio(1.2)).toBe("hot");
    expect(bandForUsageRatio(Number.NaN)).toBe("empty");
  });
});

describe("complianceMatrix", () => {
  it("returns a row x col grid of {value, band}", () => {
    const rows = ["proj-a", "proj-b"];
    const cols = ["res-1", "res-2"];
    const scores: Record<string, Record<string, number>> = {
      "proj-a": { "res-1": 0.95, "res-2": 0.5 },
      "proj-b": { "res-1": 0, "res-2": 0.8 },
    };
    const matrix = complianceMatrix(rows, cols, (r, c) => scores[r]?.[c] ?? 0);
    expect(matrix).toEqual([
      [
        { value: 0.95, band: "hot" },
        { value: 0.5, band: "ok" },
      ],
      [
        { value: 0, band: "empty" },
        { value: 0.8, band: "warn" },
      ],
    ]);
  });

  it("handles empty rows and cols", () => {
    expect(complianceMatrix([], ["c"], () => 0)).toEqual([]);
    expect(complianceMatrix(["r"], [], () => 0)).toEqual([[]]);
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
