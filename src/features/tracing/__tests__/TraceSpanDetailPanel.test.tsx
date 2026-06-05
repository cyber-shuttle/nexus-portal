import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import { TraceSpanDetailPanel } from "@features/tracing/components/TraceSpanDetailPanel";
import type { Trace, UISpan } from "@features/tracing/types";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const trace = amieFailedFixture.trace as Trace;
const failingSpan = amieFailedFixture.spans[7] as UISpan; // comanage.create_person 404

describe("TraceSpanDetailPanel", () => {
  it("renders the empty prompt when span is null", () => {
    render(
      <TraceSpanDetailPanel span={null} trace={trace} source="amie" onOpenInRaw={() => {}} />,
    );
    expect(screen.getByText(/Select a row to see span details/i)).toBeInTheDocument();
  });

  it("renders the action title, attributes, and IDs for a span with attributes", () => {
    const span = amieFailedFixture.spans[5] as UISpan; // comanage.ensure_posix with attrs
    render(
      <TraceSpanDetailPanel span={span} trace={trace} source="comanage" onOpenInRaw={() => {}} />,
    );
    expect(screen.getByText(span.name)).toBeInTheDocument();
    expect(screen.getByText("comanage.co_id")).toBeInTheDocument();
    expect(screen.getByText("Trace ID")).toBeInTheDocument();
    expect(screen.getByText("Span ID")).toBeInTheDocument();
    expect(screen.getByText("Parent")).toBeInTheDocument();
  });

  it("renders the status message for failed spans", () => {
    render(
      <TraceSpanDetailPanel
        span={failingSpan}
        trace={trace}
        source="comanage"
        onOpenInRaw={() => {}}
      />,
    );
    expect(screen.getByText("Status message")).toBeInTheDocument();
    expect(screen.getByText("404 Not Found")).toBeInTheDocument();
  });

  it("Open in Raw tab → button calls onOpenInRaw", () => {
    const onOpen = vi.fn();
    render(
      <TraceSpanDetailPanel
        span={failingSpan}
        trace={trace}
        source="comanage"
        onOpenInRaw={onOpen}
      />,
    );
    fireEvent.click(screen.getByTestId("trace-span-open-raw"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
