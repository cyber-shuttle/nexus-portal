import { describe, expect, it } from "vitest";
import {
  isProjectAtRisk,
  projectForecast,
  projectsAtRiskCount,
  topMembers,
  type PiProjectRollup,
} from "../aggregations";

const day = 24 * 60 * 60 * 1000;

function rollup(over: Partial<PiProjectRollup> = {}): PiProjectRollup {
  return {
    projectId: "proj-1",
    projectName: "Project 1",
    used: 0,
    allocated: 1000,
    forecastExhaust: null,
    endDate: null,
    atRisk: false,
    pendingChangeRequests: 0,
    firstAllocationId: null,
    ...over,
  };
}

describe("isProjectAtRisk", () => {
  it("flags projects whose forecast exhaust is more than 7 days before award end", () => {
    const end = new Date("2026-06-30T00:00:00Z");
    const exhaust = new Date(end.getTime() - 14 * day);
    expect(isProjectAtRisk(exhaust, end)).toBe(true);
  });

  it("does not flag when exhaust falls inside the 7-day buffer", () => {
    const end = new Date("2026-06-30T00:00:00Z");
    const exhaust = new Date(end.getTime() - 3 * day);
    expect(isProjectAtRisk(exhaust, end)).toBe(false);
  });

  it("does not flag when forecast or end is missing (insufficient data)", () => {
    expect(isProjectAtRisk(null, new Date())).toBe(false);
    expect(isProjectAtRisk(new Date(), null)).toBe(false);
  });

  it("honors an override buffer", () => {
    const end = new Date("2026-06-30T00:00:00Z");
    const exhaust = new Date(end.getTime() - 8 * day);
    // 8d before end is at-risk with a 7d buffer but safe with a 10d buffer.
    expect(isProjectAtRisk(exhaust, end, 7)).toBe(true);
    expect(isProjectAtRisk(exhaust, end, 10)).toBe(false);
  });
});

describe("projectsAtRiskCount", () => {
  it("counts only rollups flagged at risk", () => {
    const rollups: PiProjectRollup[] = [
      rollup({ projectId: "p1", atRisk: true }),
      rollup({ projectId: "p2", atRisk: false }),
      rollup({ projectId: "p3", atRisk: true }),
    ];
    expect(projectsAtRiskCount(rollups)).toBe(2);
  });

  it("returns zero for an empty list", () => {
    expect(projectsAtRiskCount([])).toBe(0);
  });
});

describe("topMembers", () => {
  it("aggregates per-user contributions and sorts desc", () => {
    const out = topMembers([
      { user_id: "u-1", total: 100 },
      { user_id: "u-2", total: 200 },
      { user_id: "u-1", total: 50 },
    ]);
    expect(out).toEqual([
      { user_id: "u-2", total: 200 },
      { user_id: "u-1", total: 150 },
    ]);
  });

  it("folds the tail beyond N into a single Other bucket", () => {
    const contributions = Array.from({ length: 15 }, (_, i) => ({
      user_id: `u-${i + 1}`,
      total: 100 - i, // u-1 highest, u-15 lowest
    }));
    const out = topMembers(contributions, 10);
    expect(out).toHaveLength(11);
    expect(out[0]?.user_id).toBe("u-1");
    const other = out[10];
    expect(other?.user_id).toBe("Other");
    // u-11..u-15 = 90 + 89 + 88 + 87 + 86 = 440
    expect(other?.total).toBe(440);
  });

  it("returns rows unchanged when count <= N", () => {
    const out = topMembers(
      [
        { user_id: "u-1", total: 100 },
        { user_id: "u-2", total: 200 },
      ],
      10,
    );
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.user_id === "Other")).toBeUndefined();
  });
});

describe("projectForecast", () => {
  it("returns the earliest forecast exhaust across allocations", () => {
    const a = new Date("2026-07-01T00:00:00Z");
    const b = new Date("2026-06-15T00:00:00Z");
    const c = new Date("2026-08-01T00:00:00Z");
    const out = projectForecast([
      { forecastExhaust: a },
      { forecastExhaust: b },
      { forecastExhaust: c },
    ]);
    expect(out?.toISOString()).toBe(b.toISOString());
  });

  it("ignores nulls", () => {
    const a = new Date("2026-07-01T00:00:00Z");
    const out = projectForecast([{ forecastExhaust: null }, { forecastExhaust: a }]);
    expect(out?.toISOString()).toBe(a.toISOString());
  });

  it("returns null when all forecasts are null", () => {
    expect(projectForecast([{ forecastExhaust: null }])).toBeNull();
  });
});
