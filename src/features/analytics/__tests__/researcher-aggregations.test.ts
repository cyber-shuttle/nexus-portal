import { describe, expect, it } from "vitest";
import {
  bucketUsageByDayResource,
  researcherKpisFromUsage,
  resourceMix,
  type UsagePoint,
} from "../aggregations";

const day = 24 * 60 * 60 * 1000;

function usage(overrides: Partial<UsagePoint> = {}): UsagePoint {
  return {
    compute_allocation_id: "alloc-1",
    used_su_amount: 100,
    last_updated: "2026-05-15T12:00:00Z",
    compute_allocation_resource_id: "res-1",
    ...overrides,
  };
}

describe("bucketUsageByDayResource", () => {
  it("creates one row per day in [from, to] with one column per resource", () => {
    const from = new Date("2026-05-14T00:00:00Z");
    const to = new Date("2026-05-16T23:59:59Z");
    const rows = bucketUsageByDayResource(
      [
        usage({ last_updated: "2026-05-14T08:00:00Z", used_su_amount: 50, compute_allocation_resource_id: "res-1" }),
        usage({ last_updated: "2026-05-14T20:00:00Z", used_su_amount: 30, compute_allocation_resource_id: "res-2" }),
        usage({ last_updated: "2026-05-15T10:00:00Z", used_su_amount: 70, compute_allocation_resource_id: "res-1" }),
      ],
      from,
      to,
    );
    expect(rows.seriesKeys).toEqual(["res-1", "res-2"]);
    expect(rows.rows).toHaveLength(3);
    expect(rows.rows[0]).toMatchObject({ date: "2026-05-14", "res-1": 50, "res-2": 30 });
    expect(rows.rows[1]).toMatchObject({ date: "2026-05-15", "res-1": 70, "res-2": 0 });
    expect(rows.rows[2]).toMatchObject({ date: "2026-05-16", "res-1": 0, "res-2": 0 });
  });

  it("falls back to allocation_id when resource is missing", () => {
    const from = new Date("2026-05-15T00:00:00Z");
    const to = new Date("2026-05-15T23:59:59Z");
    const rows = bucketUsageByDayResource(
      [usage({ compute_allocation_resource_id: "", last_updated: "2026-05-15T05:00:00Z" })],
      from,
      to,
    );
    expect(rows.seriesKeys).toEqual(["alloc-1"]);
    expect(rows.rows[0]).toMatchObject({ "alloc-1": 100 });
  });
});

describe("resourceMix", () => {
  it("aggregates usage by resource, sorted desc", () => {
    const slices = resourceMix([
      usage({ compute_allocation_resource_id: "res-1", used_su_amount: 200 }),
      usage({ compute_allocation_resource_id: "res-2", used_su_amount: 50 }),
      usage({ compute_allocation_resource_id: "res-1", used_su_amount: 100 }),
    ]);
    expect(slices).toEqual([
      { resource_id: "res-1", total: 300 },
      { resource_id: "res-2", total: 50 },
    ]);
  });
});

describe("researcherKpisFromUsage", () => {
  const range = {
    from: new Date("2026-05-15T00:00:00Z"),
    to: new Date("2026-05-20T00:00:00Z"),
  };

  it("computes used + burn rate + days-left from usage in range", () => {
    const result = researcherKpisFromUsage(
      [
        usage({ used_su_amount: 1000, last_updated: "2026-05-15T05:00:00Z" }),
        usage({ used_su_amount: 500, last_updated: "2026-05-17T05:00:00Z" }),
        usage({ used_su_amount: 9999, last_updated: "2026-05-10T05:00:00Z" }), // out of range, ignored
      ],
      10_000,
      range,
      null,
    );
    expect(result.usedSUs).toBe(1500);
    // 1500 / 5 days = 300/day
    expect(result.burnRatePerDay).toBeCloseTo(300, 5);
    // Remaining = 10000 - 1500 = 8500, /300 = ~28
    expect(result.daysLeft).toBe(28);
    expect(result.usedSparkline).toHaveLength(5);
    expect(result.usedSparkline[0]).toBe(1000);
    expect(result.usedSparkline[2]).toBe(500);
  });

  it("returns daysLeftHint when provided", () => {
    const result = researcherKpisFromUsage([], 10_000, range, 42);
    expect(result.daysLeft).toBe(42);
    expect(result.usedSUs).toBe(0);
  });

  it("returns null daysLeft when burn rate is zero and no hint", () => {
    const result = researcherKpisFromUsage([], 10_000, range, null);
    expect(result.daysLeft).toBeNull();
  });
});
