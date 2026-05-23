import { describe, expect, it } from "vitest";
import {
  groupTotals,
  resourceGroupMatrix,
  topConsumers,
  type ResourceUsagePoint,
} from "../aggregations";

function row(overrides: Partial<ResourceUsagePoint> = {}): ResourceUsagePoint {
  return {
    compute_allocation_id: "alloc-1",
    compute_allocation_resource_id: "res-cpu",
    used_su_amount: 100,
    last_updated: "2026-05-15T12:00:00Z",
    user_id: "user-a",
    project_id: "proj-1",
    ...overrides,
  };
}

describe("groupTotals", () => {
  it("rolls usage by allocation id and sorts by total desc", () => {
    const totals = groupTotals(
      [
        row({ compute_allocation_id: "alloc-1", used_su_amount: 100 }),
        row({ compute_allocation_id: "alloc-2", used_su_amount: 500 }),
        row({ compute_allocation_id: "alloc-1", used_su_amount: 50 }),
        row({ compute_allocation_id: "alloc-3", used_su_amount: 300 }),
      ],
      (r) => r.compute_allocation_id,
    );
    expect(totals).toEqual([
      { key: "alloc-2", total_su: 500 },
      { key: "alloc-3", total_su: 300 },
      { key: "alloc-1", total_su: 150 },
    ]);
  });

  it("rolls usage by user id", () => {
    const totals = groupTotals(
      [
        row({ user_id: "u-a", used_su_amount: 10 }),
        row({ user_id: "u-b", used_su_amount: 99 }),
        row({ user_id: "u-a", used_su_amount: 11 }),
      ],
      (r) => r.user_id,
    );
    expect(totals).toEqual([
      { key: "u-b", total_su: 99 },
      { key: "u-a", total_su: 21 },
    ]);
  });

  it("skips rows whose key is empty or undefined", () => {
    const totals = groupTotals(
      [
        row({ user_id: undefined, used_su_amount: 200 }),
        row({ user_id: "", used_su_amount: 200 }),
        row({ user_id: "u-keep", used_su_amount: 1 }),
      ],
      (r) => r.user_id,
    );
    expect(totals).toEqual([{ key: "u-keep", total_su: 1 }]);
  });
});

describe("topConsumers", () => {
  const totals = [
    { key: "res-cpu", total_su: 1000 },
    { key: "res-gpu", total_su: 500 },
    { key: "res-mem", total_su: 250 },
    { key: "res-fs", total_su: 125 },
    { key: "res-net", total_su: 125 },
    { key: "res-tiny", total_su: 5 },
  ];

  it("folds share-of-total against the whole input, not just the top N", () => {
    const rows = topConsumers(totals, (k) => k, 2);
    expect(rows).toHaveLength(2);
    // Grand total = 2005; cpu share = 1000/2005 = ~49.875
    expect(rows[0]?.key).toBe("res-cpu");
    expect(rows[0]?.share_pct).toBeCloseTo((1000 / 2005) * 100, 3);
    expect(rows[1]?.key).toBe("res-gpu");
  });

  it("tiebreaks equal totals by label asc", () => {
    const rows = topConsumers(totals, (k) => k, 5);
    // res-fs and res-net both have 125 — alphabetical label wins.
    const fsIdx = rows.findIndex((r) => r.key === "res-fs");
    const netIdx = rows.findIndex((r) => r.key === "res-net");
    expect(fsIdx).toBeLessThan(netIdx);
  });

  it("returns zero share when the input has no totals", () => {
    const rows = topConsumers([{ key: "k", total_su: 0 }], (k) => k);
    expect(rows[0]?.share_pct).toBe(0);
  });

  it("clamps to the available rows when N exceeds the input size", () => {
    const rows = topConsumers(totals.slice(0, 2), (k) => k, 5);
    expect(rows).toHaveLength(2);
  });
});

describe("resourceGroupMatrix", () => {
  it("aggregates (resource, key) intersections from a flat usage list", () => {
    const matrix = resourceGroupMatrix(
      [
        row({ compute_allocation_resource_id: "res-cpu", user_id: "u-a", used_su_amount: 10 }),
        row({ compute_allocation_resource_id: "res-cpu", user_id: "u-a", used_su_amount: 5 }),
        row({ compute_allocation_resource_id: "res-cpu", user_id: "u-b", used_su_amount: 100 }),
        row({ compute_allocation_resource_id: "res-gpu", user_id: "u-a", used_su_amount: 999 }),
      ],
      (r) => r.user_id,
    );
    expect(matrix.get("res-cpu::u-a")).toBe(15);
    expect(matrix.get("res-cpu::u-b")).toBe(100);
    expect(matrix.get("res-gpu::u-a")).toBe(999);
    expect(matrix.get("res-gpu::u-b")).toBeUndefined();
  });

  it("falls back to allocation_id when resource id is missing", () => {
    const matrix = resourceGroupMatrix(
      [
        row({
          compute_allocation_id: "alloc-1",
          compute_allocation_resource_id: "",
          user_id: "u-a",
          used_su_amount: 7,
        }),
      ],
      (r) => r.user_id,
    );
    expect(matrix.get("alloc-1::u-a")).toBe(7);
  });

  it("skips rows where the group key is missing", () => {
    const matrix = resourceGroupMatrix(
      [
        row({ user_id: undefined, used_su_amount: 9 }),
        row({ user_id: "u-keep", used_su_amount: 1 }),
      ],
      (r) => r.user_id,
    );
    expect(matrix.size).toBe(1);
    expect(matrix.get("res-cpu::u-keep")).toBe(1);
  });
});
