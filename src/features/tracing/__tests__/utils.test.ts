import type { Span } from "@features/tracing/types";
import {
  buildParentKeyMap,
  buildSpanTree,
  computeSiblingP95,
  extractLinkedEntities,
  flattenTree,
  isRetryRoot,
  percentile,
} from "@features/tracing/utils";
import { describe, expect, it } from "vitest";

// Minimal Span factory — schema requires hex IDs and ISO timestamps, but the
// pure utils only read the fields named here. Cast as Span to satisfy types.
function span(partial: Partial<Span> & { span_id: string }): Span {
  return {
    span_id: partial.span_id,
    parent_span_id: partial.parent_span_id,
    name: partial.name ?? "op",
    kind: partial.kind ?? 0,
    status: partial.status ?? 0,
    status_message: partial.status_message ?? null,
    start_time: partial.start_time ?? "2025-01-01T00:00:00.000Z",
    end_time: partial.end_time ?? "2025-01-01T00:00:00.010Z",
    attributes: partial.attributes ?? null,
  } as Span;
}

describe("isRetryRoot", () => {
  it("matches name starting with retry:", () => {
    expect(isRetryRoot(span({ span_id: "a", name: "retry:foo" }))).toBe(true);
  });
  it("matches retry.attempt attribute even without name prefix", () => {
    expect(
      isRetryRoot(span({ span_id: "a", name: "foo", attributes: { "retry.attempt": 1 } })),
    ).toBe(true);
  });
  it("returns false for plain spans", () => {
    expect(isRetryRoot(span({ span_id: "a", name: "foo" }))).toBe(false);
  });
  it("tolerates null / non-object attributes", () => {
    expect(isRetryRoot(span({ span_id: "a", name: "foo", attributes: null }))).toBe(false);
    expect(
      isRetryRoot(span({ span_id: "a", name: "foo", attributes: "nope" as unknown as never })),
    ).toBe(false);
  });
});

describe("buildSpanTree", () => {
  it("produces correct depth for a root with two children and a grandchild", () => {
    const spans = [
      span({ span_id: "r", parent_span_id: undefined, start_time: "2025-01-01T00:00:00.000Z" }),
      span({ span_id: "c1", parent_span_id: "r", start_time: "2025-01-01T00:00:00.001Z" }),
      span({ span_id: "c2", parent_span_id: "r", start_time: "2025-01-01T00:00:00.002Z" }),
      span({ span_id: "g", parent_span_id: "c1", start_time: "2025-01-01T00:00:00.003Z" }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree).toHaveLength(1);
    const root = tree[0];
    expect(root?.depth).toBe(0);
    expect(root?.children.map((c) => c.span.span_id)).toEqual(["c1", "c2"]);
    expect(root?.children[0]?.depth).toBe(1);
    expect(root?.children[0]?.children[0]?.depth).toBe(2);
  });
  it("treats an orphan (parent outside input) as a root", () => {
    const spans = [
      span({ span_id: "a", parent_span_id: undefined }),
      span({ span_id: "b", parent_span_id: "missing" }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree.map((n) => n.span.span_id).sort()).toEqual(["a", "b"]);
  });
  it("does not infinite-loop on a 2-cycle (defense-in-depth)", () => {
    const spans = [
      span({ span_id: "a", parent_span_id: "b" }),
      span({ span_id: "b", parent_span_id: "a" }),
    ];
    // Both spans have an in-set parent so neither is a root by the current
    // rules — the function must still return a bounded result, not loop.
    const tree = buildSpanTree(spans);
    expect(Array.isArray(tree)).toBe(true);
  });
  it("lifts a retry span with non-null parent to a top-level sibling", () => {
    const spans = [
      span({ span_id: "r", parent_span_id: undefined, start_time: "2025-01-01T00:00:00.000Z" }),
      span({
        span_id: "y",
        parent_span_id: "r",
        name: "retry:foo",
        start_time: "2025-01-01T00:00:00.005Z",
      }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree.map((n) => n.span.span_id)).toEqual(["r", "y"]);
    expect(tree[0]?.children).toHaveLength(0);
  });
  it("sorts siblings by start_time ascending", () => {
    const spans = [
      span({ span_id: "r", parent_span_id: undefined }),
      span({ span_id: "late", parent_span_id: "r", start_time: "2025-01-01T00:00:00.010Z" }),
      span({ span_id: "early", parent_span_id: "r", start_time: "2025-01-01T00:00:00.001Z" }),
    ];
    const tree = buildSpanTree(spans);
    expect(tree[0]?.children.map((c) => c.span.span_id)).toEqual(["early", "late"]);
  });
});

describe("flattenTree", () => {
  it("renders depth=0 for roots and depth=1 for direct children", () => {
    const spans = [
      span({ span_id: "r", parent_span_id: undefined }),
      span({ span_id: "c", parent_span_id: "r" }),
    ];
    const flat = flattenTree(buildSpanTree(spans));
    expect(flat.map((n) => n.depth)).toEqual([0, 1]);
  });
  it("collapses spans past MAX_DEPTH (50) into a collapsedCount marker", () => {
    const spans: Span[] = [];
    for (let i = 0; i < 60; i++) {
      spans.push(
        span({
          span_id: `s${i}`,
          parent_span_id: i === 0 ? undefined : `s${i - 1}`,
        }),
      );
    }
    const flat = flattenTree(buildSpanTree(spans));
    // Beyond the depth cap the function emits a node with collapsedCount > 0
    // instead of continuing to recurse, so the flat list never reaches 60.
    expect(flat.length).toBeLessThan(60);
    expect(flat.some((n) => n.collapsedCount > 0)).toBe(true);
  });
});

describe("percentile", () => {
  it("returns 0 for an empty input", () => {
    const v = percentile([], 95);
    expect(Number.isFinite(v)).toBe(true);
    expect(v).toBe(0);
  });
  it("returns the value when n=1", () => {
    expect(percentile([42], 95)).toBe(42);
  });
  it("returns that value when all inputs are identical", () => {
    expect(percentile([7, 7, 7, 7], 95)).toBe(7);
  });
  it("returns a finite number for small-n input", () => {
    const v = percentile([1, 2, 3], 95);
    expect(Number.isFinite(v)).toBe(true);
    expect(Number.isNaN(v)).toBe(false);
  });
});

describe("computeSiblingP95", () => {
  it("groups durations by parent, keyed by parent span_id", () => {
    const spans = [
      span({
        span_id: "r",
        parent_span_id: undefined,
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:00:00.100Z",
      }),
      span({
        span_id: "c1",
        parent_span_id: "r",
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:00:00.010Z",
      }),
      span({
        span_id: "c2",
        parent_span_id: "r",
        start_time: "2025-01-01T00:00:00.001Z",
        end_time: "2025-01-01T00:00:00.020Z",
      }),
    ];
    const tree = buildSpanTree(spans);
    const p95 = computeSiblingP95(tree);
    expect(p95.has("")).toBe(true); // root bucket
    expect(p95.has("r")).toBe(true); // r's children bucket
    expect((p95.get("r") ?? 0) > 0).toBe(true);
  });
  it("excludes zero-duration spans from the percentile", () => {
    const spans = [
      span({
        span_id: "r",
        parent_span_id: undefined,
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:00:00.000Z",
      }),
    ];
    const p95 = computeSiblingP95(buildSpanTree(spans));
    // Only span has 0 duration, so the root bucket reduces to empty → 0.
    expect(p95.get("")).toBe(0);
  });
  it("places retry roots in the empty-string root bucket alongside the original root", () => {
    const spans = [
      span({
        span_id: "r",
        parent_span_id: undefined,
        start_time: "2025-01-01T00:00:00.000Z",
        end_time: "2025-01-01T00:00:00.010Z",
      }),
      span({
        span_id: "y",
        parent_span_id: "r",
        name: "retry:foo",
        start_time: "2025-01-01T00:00:00.020Z",
        end_time: "2025-01-01T00:00:00.030Z",
      }),
    ];
    const p95 = computeSiblingP95(buildSpanTree(spans));
    expect(p95.has("")).toBe(true);
    expect((p95.get("") ?? 0) > 0).toBe(true);
  });
});

describe("buildParentKeyMap", () => {
  it("maps children to their parent span_id", () => {
    const spans = [
      span({ span_id: "r", parent_span_id: undefined }),
      span({ span_id: "c", parent_span_id: "r" }),
    ];
    const map = buildParentKeyMap(buildSpanTree(spans));
    expect(map.get("c")).toBe("r");
  });
  it("maps roots (incl. orphans) to the empty-string root key", () => {
    const spans = [
      span({ span_id: "r", parent_span_id: undefined }),
      span({ span_id: "o", parent_span_id: "missing" }),
    ];
    const map = buildParentKeyMap(buildSpanTree(spans));
    expect(map.get("r")).toBe("");
    expect(map.get("o")).toBe("");
  });
});

describe("extractLinkedEntities", () => {
  it("walks all spans and dedupes the same packet across child + root", () => {
    const spans = [
      span({
        span_id: "r",
        parent_span_id: undefined,
        attributes: { "amie.packet_id": "PKT-1", "amie.event_type": "request_account_create" },
      }),
      span({
        span_id: "c",
        parent_span_id: "r",
        attributes: { "amie.packet_id": "PKT-1" },
      }),
    ];
    const entities = extractLinkedEntities(spans);
    const packets = entities.filter((e) => e.kind === "amiePacket");
    expect(packets).toHaveLength(1);
    expect(packets[0]?.primaryId).toBe("PKT-1");
  });
  it("does not throw when attributes is a string, array, or number", () => {
    const spans = [
      span({ span_id: "a", attributes: "not-an-object" as unknown as never }),
      span({ span_id: "b", attributes: [1, 2, 3] as unknown as never }),
      span({ span_id: "c", attributes: 42 as unknown as never }),
    ];
    expect(() => extractLinkedEntities(spans)).not.toThrow();
    expect(extractLinkedEntities(spans)).toEqual([]);
  });
  it("produces an equivalent set when input order is reversed", () => {
    const spans = [
      span({ span_id: "a", attributes: { "amie.packet_id": "PKT-1" } }),
      span({ span_id: "b", attributes: { "slurm.allocation_id": "ALLOC-9" } }),
      span({ span_id: "c", attributes: { "slurm.cluster_id": "CLU-2" } }),
    ];
    const forward = extractLinkedEntities(spans);
    const reversed = extractLinkedEntities([...spans].reverse());
    const key = (e: { kind: string; primaryId?: string }) => `${e.kind}::${e.primaryId}`;
    expect(new Set(forward.map(key))).toEqual(new Set(reversed.map(key)));
  });
});
