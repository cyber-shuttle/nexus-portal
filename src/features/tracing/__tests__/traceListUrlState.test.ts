import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTERS,
  type ListFilters,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  statusFiltersToApi,
  windowToFromTo,
} from "@features/tracing/components/traceListUrlState";

function p(qs: string): URLSearchParams {
  return new URLSearchParams(qs);
}

describe("traceListUrlState — parseFilters", () => {
  it("returns defaults when params are empty", () => {
    expect(parseFilters(p(""))).toEqual(DEFAULT_FILTERS);
  });

  it("drops bogus status / source / window values", () => {
    const params = p("status=bogus&source=evil&window=42y&pageSize=7");
    const f = parseFilters(params);
    // bogus status filtered → empty array (not the defaults)
    expect(f.status).toEqual([]);
    expect(f.source).toEqual([]);
    expect(f.window).toBe("30d");
    expect(f.pageSize).toBe(50);
  });

  it("falls back page < 1 to 1, page invalid to 1", () => {
    expect(parseFilters(p("page=0")).page).toBe(1);
    expect(parseFilters(p("page=-3")).page).toBe(1);
    expect(parseFilters(p("page=abc")).page).toBe(1);
    expect(parseFilters(p("page=4")).page).toBe(4);
  });

  it("accepts only 25/50/100 for pageSize", () => {
    expect(parseFilters(p("pageSize=25")).pageSize).toBe(25);
    expect(parseFilters(p("pageSize=100")).pageSize).toBe(100);
    expect(parseFilters(p("pageSize=37")).pageSize).toBe(50);
  });

  it("preserves the order of repeated source values", () => {
    const f = parseFilters(p("source=amie&source=slurm"));
    expect(f.source).toEqual(["amie", "slurm"]);
  });

  it("trims the q query", () => {
    expect(parseFilters(p("q=%20alice%20")).q).toBe("alice");
  });
});

describe("traceListUrlState — serializeFilters", () => {
  it("omits all defaults", () => {
    expect(serializeFilters(DEFAULT_FILTERS).toString()).toBe("");
  });

  it("emits status entries when changed", () => {
    const filters: ListFilters = { ...DEFAULT_FILTERS, status: ["ok", "error"] };
    const qs = serializeFilters(filters).toString();
    expect(qs).toContain("status=ok");
    expect(qs).toContain("status=error");
  });

  it("does not emit status when it equals the default", () => {
    const qs = serializeFilters({ ...DEFAULT_FILTERS, status: ["error"] }).toString();
    expect(qs).toBe("");
  });

  it("emits window/page/pageSize only when off-default", () => {
    const filters: ListFilters = {
      ...DEFAULT_FILTERS,
      window: "24h",
      page: 3,
      pageSize: 100,
    };
    const qs = serializeFilters(filters);
    expect(qs.get("window")).toBe("24h");
    expect(qs.get("page")).toBe("3");
    expect(qs.get("pageSize")).toBe("100");
  });
});

describe("traceListUrlState — round-trip", () => {
  it("parse(serialize(filters)) === filters for typical edits", () => {
    const f: ListFilters = {
      status: ["error", "ok"],
      source: ["amie", "comanage"],
      window: "7d",
      q: "alice",
      page: 2,
      pageSize: 25,
    };
    const out = parseFilters(serializeFilters(f));
    expect(new Set(out.status)).toEqual(new Set(f.status));
    expect(new Set(out.source)).toEqual(new Set(f.source));
    expect(out.window).toBe(f.window);
    expect(out.q).toBe(f.q);
    expect(out.page).toBe(f.page);
    expect(out.pageSize).toBe(f.pageSize);
  });
});

describe("traceListUrlState — hasActiveFilters", () => {
  it("is false for defaults", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it("is true when status differs, source set, window changed, or q present", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, status: ["ok"] })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, source: ["amie"] })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, window: "24h" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, q: "x" })).toBe(true);
  });
});

describe("traceListUrlState — windowToFromTo", () => {
  it("anchors to/from at now and now − N days", () => {
    const now = Date.parse("2026-06-05T12:00:00.000Z");
    const r24 = windowToFromTo("24h", now);
    expect(r24.to).toBe("2026-06-05T12:00:00.000Z");
    expect(r24.from).toBe("2026-06-04T12:00:00.000Z");
    const r7 = windowToFromTo("7d", now);
    expect(r7.from).toBe("2026-05-29T12:00:00.000Z");
    const r30 = windowToFromTo("30d", now);
    expect(r30.from).toBe("2026-05-06T12:00:00.000Z");
  });
});

describe("traceListUrlState — statusFiltersToApi", () => {
  it("maps ok→0, error→1, orphaned→3", () => {
    const { apiStatus, inProgressOnly } = statusFiltersToApi(["ok", "error", "orphaned"]);
    expect(new Set(apiStatus)).toEqual(new Set([0, 1, 3]));
    expect(inProgressOnly).toBe(false);
  });

  it("strips in-progress from the wire and flags it when sole filter", () => {
    const sole = statusFiltersToApi(["in-progress"]);
    expect(sole.apiStatus).toEqual([]);
    expect(sole.inProgressOnly).toBe(true);

    const mixed = statusFiltersToApi(["in-progress", "error"]);
    expect(mixed.apiStatus).toEqual([1]);
    expect(mixed.inProgressOnly).toBe(false);
  });
});
