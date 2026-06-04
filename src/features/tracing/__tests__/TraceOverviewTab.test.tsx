import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import httpTraceFixture from "@features/tracing/__fixtures__/trace.http.fixture.json";
import orphanedFixture from "@features/tracing/__fixtures__/trace.orphaned.fixture.json";
import type { Span, Trace } from "@features/tracing/types";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const can = vi.fn<(action: string, subject: string) => boolean>();

vi.mock("@shared/casl/AbilityProvider", () => ({
  useAbility: () => ({ can }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// next/dynamic returns a passthrough so we can assert the JSON view actually
// renders the payload without waiting for the lazy import.
vi.mock("next/dynamic", () => ({
  default: () =>
    function StubJsonView({ data }: { data: unknown }) {
      return <pre data-testid="payload-json">{JSON.stringify(data)}</pre>;
    },
}));

import { TraceOverviewTab } from "../components/TraceOverviewTab";

beforeEach(() => {
  can.mockReset();
  toastSuccess.mockReset();
  toastError.mockReset();
  can.mockReturnValue(true);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderWith(traceFixture: { trace: unknown; spans: unknown }) {
  const trace = traceFixture.trace as Trace;
  const spans = traceFixture.spans as Span[];
  const onRetry = vi.fn();
  const onSwitchToTab = vi.fn();
  render(
    <TraceOverviewTab
      trace={trace}
      spans={spans}
      onRetry={onRetry}
      onSwitchToTab={onSwitchToTab}
    />,
  );
  return { trace, spans, onRetry, onSwitchToTab };
}

describe("TraceOverviewTab", () => {
  it("renders all MetaItems and enables Retry for the AMIE failed fixture", () => {
    const { trace } = renderWith(amieFailedFixture);
    // MetaRow renders labels as "<label> :"; match the label text with a colon.
    expect(screen.getByText(/Trace ID\s*:/)).toBeInTheDocument();
    expect(screen.getByText(trace.trace_id)).toBeInTheDocument();
    expect(screen.getByText(/Source\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/Started\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/Ended\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/Duration\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/Spans\s*:/)).toBeInTheDocument();
    expect(screen.getByText(/Root operation\s*:/)).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: /Retry this flow/i });
    expect(retry).not.toBeDisabled();
  });

  it("renders the attempts strip for a trace with retry:* spans", () => {
    renderWith(amieFailedFixture);
    const list = screen.getByRole("list", { name: /Retry attempts/i });
    expect(list).toBeInTheDocument();
    // AMIE failed fixture has one retry span with retry.attempt=1, so the
    // user-visible labels are Attempt 1 (original root) and Attempt 2 (first
    // retry — counter+1). Assert exact labels and DOM ordering.
    const attempt1 = within(list).getByText("Attempt 1");
    const attempt2 = within(list).getByText("Attempt 2");
    expect(attempt1).toBeInTheDocument();
    expect(attempt2).toBeInTheDocument();
    expect(within(list).queryByText("Attempt 3")).not.toBeInTheDocument();
    // Attempt 2's pill must appear after Attempt 1's in DOM order.
    const items = list.querySelectorAll("li");
    expect(items[0]).toContainElement(attempt1);
    expect(items[1]).toContainElement(attempt2);
  });

  it("disables Retry when source is not amie (orphaned fixture)", () => {
    renderWith(orphanedFixture);
    const retry = screen.getByRole("button", { name: /Retry this flow/i });
    expect(retry).toBeDisabled();
    // Orphaned fixture has source=slurm; computeRetryGate checks source
    // before payload, so the surfaced tooltip is the source message.
    // `title` is the DOM mirror of the tooltip reason.
    expect(retry).toHaveAttribute("title", expect.stringMatching(/not supported.*slurm/i));
  });

  it("disables Retry with the 'no payload captured' message for an AMIE trace missing root_event", () => {
    const noPayloadFixture = {
      trace: { ...amieFailedFixture.trace, root_event: null },
      spans: amieFailedFixture.spans,
    };
    renderWith(noPayloadFixture);
    const retry = screen.getByRole("button", { name: /Retry this flow/i });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute(
      "title",
      expect.stringMatching(/Retry requires the original payload/i),
    );
  });

  it("renders 'No payload captured for this trace.' when root_event is null", () => {
    renderWith(httpTraceFixture);
    expect(screen.getByText(/No payload captured for this trace\./i)).toBeInTheDocument();
  });

  it("disables Retry on the HTTP fixture (source not supported)", () => {
    renderWith(httpTraceFixture);
    const retry = screen.getByRole("button", { name: /Retry this flow/i });
    // status=0 (success) triggers the 'cannot retry a successful trace' gate
    // first; either way, the button is disabled.
    expect(retry).toBeDisabled();
  });

  it("disables Retry when the user lacks the retry ability", () => {
    can.mockReturnValue(false);
    renderWith(amieFailedFixture);
    const retry = screen.getByRole("button", { name: /Retry this flow/i });
    expect(retry).toBeDisabled();
  });

  it("renders payload preview for the AMIE success fixture", () => {
    renderWith(amieSuccessFixture);
    expect(screen.getByTestId("payload-json")).toBeInTheDocument();
  });

  it("copies trace_id to clipboard when the Copy button is clicked", async () => {
    const { trace } = renderWith(amieSuccessFixture);
    const copy = screen.getByRole("button", { name: /^Copy trace ID$/i });
    copy.click();
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(trace.trace_id);
    });
  });

  it("calls onSwitchToTab('linked') when View linked entities is clicked", () => {
    const { onSwitchToTab } = renderWith(amieSuccessFixture);
    screen.getByRole("button", { name: /View linked entities/i }).click();
    expect(onSwitchToTab).toHaveBeenCalledWith("linked");
  });

  it("calls onSwitchToTab('waterfall', spanId) when the Attempt 1 pill is clicked", () => {
    const { onSwitchToTab } = renderWith(amieFailedFixture);
    const list = screen.getByRole("list", { name: /Retry attempts/i });
    const btn = within(list).getByText("Attempt 1").closest("button");
    btn?.click();
    expect(onSwitchToTab).toHaveBeenCalledWith(
      "waterfall",
      expect.stringMatching(/^[0-9a-f]{16}$/),
    );
  });
});
