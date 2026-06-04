import {
  DEFAULT_FILTERS,
  parseFilters,
  serializeFilters,
} from "@features/tracing/components/traceListUrlState";
import { describe, expect, it } from "vitest";

function from(s: string): URLSearchParams {
  return new URLSearchParams(s);
}

describe("traceListUrlState", () => {
  it("omits defaults from the serialized URL", () => {
    const params = serializeFilters(DEFAULT_FILTERS);
    expect(params.toString()).toBe("");
  });

  it("sorts status numerically and source alphabetically so cache keys are stable", () => {
    const a = serializeFilters({
      ...DEFAULT_FILTERS,
      status: [3, 1, 0],
      source: ["slurm", "amie", "http"],
    });
    const b = serializeFilters({
      ...DEFAULT_FILTERS,
      status: [1, 0, 3],
      source: ["http", "amie", "slurm"],
    });
    expect(a.toString()).toBe(b.toString());
    expect(a.getAll("status")).toEqual(["0", "1", "3"]);
    expect(a.getAll("source")).toEqual(["amie", "http", "slurm"]);
  });

  it("falls back to preset=30d when the URL preset is invalid", () => {
    expect(parseFilters(from("preset=bogus")).preset).toBe("30d");
    expect(parseFilters(from("")).preset).toBe("30d");
  });

  it("falls back to limit=50 / offset=0 when the URL values are non-numeric", () => {
    const p = parseFilters(from("limit=abc&offset=-1"));
    expect(p.limit).toBe(50);
    expect(p.offset).toBe(0);
  });

  it("filters out-of-range status values from the URL", () => {
    const p = parseFilters(from("status=0&status=999&status=2&status=-1"));
    expect(p.status).toEqual([0, 2]);
  });

  it("filters unknown sources from the URL (matches the filter strip whitelist)", () => {
    const p = parseFilters(from("source=amie&source=core&source=slurm"));
    expect(p.source).toEqual(["amie", "slurm"]);
  });

  it("round-trips filters through serialize → parse", () => {
    const original = {
      ...DEFAULT_FILTERS,
      status: [1, 3],
      source: ["amie", "comanage"],
      preset: "custom" as const,
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-31T23:59:59.999Z",
      q: "trace-foo",
      limit: 100,
      offset: 100,
    };
    const params = serializeFilters(original);
    const parsed = parseFilters(params);
    expect(parsed).toEqual({
      status: [1, 3],
      source: ["amie", "comanage"],
      preset: "custom",
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-31T23:59:59.999Z",
      q: "trace-foo",
      limit: 100,
      offset: 100,
    });
  });

  it("omits custom from/to when preset is not custom", () => {
    const params = serializeFilters({
      ...DEFAULT_FILTERS,
      preset: "7d",
      from: "2026-05-01T00:00:00.000Z",
      to: "2026-05-31T23:59:59.999Z",
    });
    expect(params.get("from")).toBeNull();
    expect(params.get("to")).toBeNull();
    expect(params.get("preset")).toBe("7d");
  });
});
