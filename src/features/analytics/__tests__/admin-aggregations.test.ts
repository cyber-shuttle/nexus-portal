import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AdminAtRiskRow,
  type AdminProjectBurn,
  atRiskAllocations,
  complianceCell,
  sitePace,
  topProjectsByBurn,
} from "../aggregations";

const day = 24 * 60 * 60 * 1000;

describe("sitePace", () => {
  it("returns used / allocated when both are positive", () => {
    expect(sitePace(250, 1000)).toBeCloseTo(0.25);
  });

  it("returns 0 when no allocation exists (avoids NaN/Infinity in the KPI)", () => {
    expect(sitePace(100, 0)).toBe(0);
    expect(sitePace(0, 0)).toBe(0);
  });

  it("returns 0 when allocated is negative (data integrity guard)", () => {
    expect(sitePace(50, -10)).toBe(0);
  });
});

describe("topProjectsByBurn", () => {
  const make = (id: string, used: number, allocated = 1000): AdminProjectBurn => ({
    projectId: id,
    projectName: `Project ${id}`,
    used,
    allocated,
    firstAllocationId: `alloc-${id}`,
  });

  it("sorts projects by used desc and trims to N", () => {
    const out = topProjectsByBurn(
      [make("a", 100), make("b", 500), make("c", 200), make("d", 50)],
      2,
    );
    expect(out.map((p) => p.projectId)).toEqual(["b", "c"]);
  });

  it("returns the full sorted list when count <= N", () => {
    const out = topProjectsByBurn([make("a", 100), make("b", 500)], 10);
    expect(out.map((p) => p.projectId)).toEqual(["b", "a"]);
  });

  it("does not mutate the input array", () => {
    const input = [make("a", 100), make("b", 500)];
    const snapshot = input.map((p) => p.projectId);
    topProjectsByBurn(input, 1);
    expect(input.map((p) => p.projectId)).toEqual(snapshot);
  });
});

describe("complianceCell", () => {
  it("returns null when input is null (no allocation at the intersection)", () => {
    expect(complianceCell(null)).toBeNull();
  });

  it("returns null when allocated is zero (avoids divide-by-zero)", () => {
    expect(complianceCell({ used: 100, allocated: 0 })).toBeNull();
  });

  it("bands hot at >= 90%", () => {
    expect(complianceCell({ used: 90, allocated: 100 })?.band).toBe("hot");
    expect(complianceCell({ used: 95, allocated: 100 })?.band).toBe("hot");
  });

  it("bands warn at >= 75% and < 90%", () => {
    expect(complianceCell({ used: 75, allocated: 100 })?.band).toBe("warn");
    expect(complianceCell({ used: 89, allocated: 100 })?.band).toBe("warn");
  });

  it("bands ok at >= 1% and < 75%", () => {
    expect(complianceCell({ used: 1, allocated: 100 })?.band).toBe("ok");
    expect(complianceCell({ used: 50, allocated: 100 })?.band).toBe("ok");
  });

  it("bands empty when usage is effectively zero (< 1%)", () => {
    expect(complianceCell({ used: 0, allocated: 100 })?.band).toBe("empty");
    expect(complianceCell({ used: 0.5, allocated: 100 })?.band).toBe("empty");
  });

  it("returns the raw ratio as `value` so callers can format it", () => {
    expect(complianceCell({ used: 750, allocated: 1000 })?.value).toBeCloseTo(0.75);
  });
});

describe("atRiskAllocations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const row = (over: Partial<AdminAtRiskRow> = {}): AdminAtRiskRow => ({
    projectId: "p-1",
    projectName: "Project 1",
    resourceId: "r-1",
    resourceName: "Resource 1",
    allocationId: "alloc-1",
    usedPct: 50,
    daysToExhaust: 30,
    endDate: new Date("2026-12-31T00:00:00Z"),
    ownerId: "pi@nexus.local",
    ...over,
  });

  it("flags allocations whose forecast exhaust falls before the end date", () => {
    const rows: AdminAtRiskRow[] = [
      row({ allocationId: "a-near", daysToExhaust: 30, endDate: new Date("2026-12-31") }),
      row({
        allocationId: "a-safe",
        daysToExhaust: 400,
        endDate: new Date("2026-06-30"),
      }),
    ];
    const out = atRiskAllocations(rows);
    expect(out.map((r) => r.allocationId)).toEqual(["a-near"]);
  });

  it("drops rows with no forecast (null daysToExhaust) — they have no signal", () => {
    const out = atRiskAllocations([
      row({ allocationId: "a-null-days", daysToExhaust: null }),
    ]);
    expect(out).toEqual([]);
  });

  it("drops rows with no end date — at-risk classification needs both sides", () => {
    const out = atRiskAllocations([row({ allocationId: "a-null-end", endDate: null })]);
    expect(out).toEqual([]);
  });

  it("sorts the kept rows by daysToExhaust ascending (most urgent first)", () => {
    const rows: AdminAtRiskRow[] = [
      row({ allocationId: "a-30", daysToExhaust: 30 }),
      row({ allocationId: "a-5", daysToExhaust: 5 }),
      row({ allocationId: "a-90", daysToExhaust: 90 }),
    ];
    const out = atRiskAllocations(rows);
    expect(out.map((r) => r.allocationId)).toEqual(["a-5", "a-30", "a-90"]);
  });
});
