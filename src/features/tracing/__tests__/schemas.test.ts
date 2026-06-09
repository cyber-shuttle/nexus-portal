import auditEventsFixture from "@features/tracing/__fixtures__/audit-events.fixture.json";
import statsFixture from "@features/tracing/__fixtures__/stats.fixture.json";
import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import httpTraceFixture from "@features/tracing/__fixtures__/trace.http.fixture.json";
import orphanedFixture from "@features/tracing/__fixtures__/trace.orphaned.fixture.json";
import listFixture from "@features/tracing/__fixtures__/traces.list.fixture.json";
import {
  auditEventsResponseSchema,
  spanSchema,
  traceDetailResponseSchema,
  traceListResponseSchema,
  traceSchema,
  traceStatsResponseSchema,
} from "@features/tracing/schemas";
import { describe, expect, it } from "vitest";

describe("tracing schemas — fixtures", () => {
  it("parses the list fixture", () => {
    expect(() => traceListResponseSchema.parse(listFixture)).not.toThrow();
  });

  it("parses the AMIE success detail fixture", () => {
    expect(() => traceDetailResponseSchema.parse(amieSuccessFixture)).not.toThrow();
  });

  it("parses the AMIE failed detail fixture (incl. retry span)", () => {
    const parsed = traceDetailResponseSchema.parse(amieFailedFixture);
    const retry = parsed.spans.find((s) => s.name.startsWith("retry:"));
    expect(retry).toBeDefined();
    expect(retry?.parent_span_id).toBeDefined();
  });

  it("parses the HTTP detail fixture", () => {
    expect(() => traceDetailResponseSchema.parse(httpTraceFixture)).not.toThrow();
  });

  it("parses the orphaned detail fixture (status=3, missing ended_at, missing root_event)", () => {
    const parsed = traceDetailResponseSchema.parse(orphanedFixture);
    expect(parsed.trace.status).toBe(3);
    expect(parsed.trace.ended_at).toBeUndefined();
    expect(parsed.trace.root_event).toBeUndefined();
  });

  it("parses the stats fixture", () => {
    expect(() => traceStatsResponseSchema.parse(statsFixture)).not.toThrow();
  });

  it("parses the audit-events fixture", () => {
    expect(() => auditEventsResponseSchema.parse(auditEventsFixture)).not.toThrow();
  });
});

describe("tracing schemas — null tolerance", () => {
  const baseTrace = {
    trace_id: "a3b1c92d3f4e5a6b7c8d9e0f12345678",
    root_name: "amie.process_event:request_account_create",
    source: "amie" as const,
    status: 0,
    started_at: "2026-06-03T14:21:32.412Z",
    span_count: 1,
  };

  it("accepts explicit null root_event", () => {
    expect(() => traceSchema.parse({ ...baseTrace, root_event: null })).not.toThrow();
  });

  it("accepts omitted root_event", () => {
    expect(() => traceSchema.parse(baseTrace)).not.toThrow();
  });

  it("accepts explicit null ended_at and missing ended_at", () => {
    expect(() => traceSchema.parse({ ...baseTrace, ended_at: null })).not.toThrow();
    expect(() => traceSchema.parse(baseTrace)).not.toThrow();
  });

  const baseSpan = {
    span_id: "0000000000000001",
    name: "amie.process_event",
    kind: 0,
    status: 0,
    start_time: "2026-06-03T14:21:32.412Z",
  };

  it("accepts null/missing attributes on a span", () => {
    expect(() => spanSchema.parse({ ...baseSpan, attributes: null })).not.toThrow();
    expect(() => spanSchema.parse(baseSpan)).not.toThrow();
  });

  it("accepts null/missing end_time and status_message on a span", () => {
    expect(() =>
      spanSchema.parse({ ...baseSpan, end_time: null, status_message: null }),
    ).not.toThrow();
    expect(() => spanSchema.parse(baseSpan)).not.toThrow();
  });

  it("treats parent_span_id as optional but rejects explicit null (backend omits, never nulls)", () => {
    expect(() =>
      spanSchema.parse({ ...baseSpan, parent_span_id: "0000000000000002" }),
    ).not.toThrow();
    expect(() => spanSchema.parse(baseSpan)).not.toThrow();
    const result = spanSchema.safeParse({ ...baseSpan, parent_span_id: null });
    expect(result.success).toBe(false);
  });
});
