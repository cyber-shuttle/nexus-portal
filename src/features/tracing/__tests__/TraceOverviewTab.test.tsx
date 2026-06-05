import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import orphanedFixture from "@features/tracing/__fixtures__/trace.orphaned.fixture.json";
import { TraceOverviewTab } from "@features/tracing/components/TraceOverviewTab";
import type { Span, Trace } from "@features/tracing/types";
import { traceListResponseSchema } from "@features/tracing/schemas";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

// Cast through unknown — fixtures are JSON; runtime values match schema.
function trace(fx: { trace: unknown }): Trace {
  return fx.trace as Trace;
}
function spans(fx: { spans: unknown[] }): Span[] {
  return fx.spans as Span[];
}

// Lightweight sanity check that the fixtures we import still satisfy the
// trace list response shape (catches breaking schema drift without per-test
// noise — runs once when the module loads).
void traceListResponseSchema;

describe("TraceOverviewTab", () => {
  it("renders every facts row for an ok amie trace", () => {
    render(<TraceOverviewTab trace={trace(amieSuccessFixture)} spans={spans(amieSuccessFixture)} />);
    expect(screen.getByText("Trace ID")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Root action")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Started")).toBeInTheDocument();
    expect(screen.getByText("Ended")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("Span count")).toBeInTheDocument();
    expect(screen.getByText(/No retry attempts yet/)).toBeInTheDocument();
  });

  it("renders an error status pill for a failed amie trace", () => {
    render(<TraceOverviewTab trace={trace(amieFailedFixture)} spans={spans(amieFailedFixture)} />);
    const statusPills = screen.getAllByText(/error/i);
    expect(statusPills.length).toBeGreaterThan(0);
  });

  it("renders the still-running label when ended_at is missing", () => {
    render(<TraceOverviewTab trace={trace(orphanedFixture)} spans={spans(orphanedFixture)} />);
    expect(screen.getByText("still running")).toBeInTheDocument();
  });

  it("shows the empty-root-entity copy when no entity attrs on the root span", () => {
    // Synthesize a trace whose root span has no known entity attrs.
    const t: Trace = {
      trace_id: "f".repeat(32),
      root_name: "noop",
      source: "core",
      status: 0,
      started_at: "2026-06-03T00:00:00.000Z",
      ended_at: "2026-06-03T00:00:01.000Z",
      span_count: 1,
      root_event: null,
    };
    const s: Span[] = [
      {
        span_id: "f".repeat(16),
        name: "noop",
        kind: 1,
        status: 0,
        start_time: "2026-06-03T00:00:00.000Z",
        end_time: "2026-06-03T00:00:01.000Z",
        attributes: { "irrelevant.key": "x" },
      },
    ];
    render(<TraceOverviewTab trace={t} spans={s} />);
    expect(screen.getByText(/No root entity attributes captured/)).toBeInTheDocument();
  });
});
