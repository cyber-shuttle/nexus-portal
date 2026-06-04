import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import type { Span, Trace } from "@features/tracing/types";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

// next/dynamic returns a passthrough stub so we can assert the JSON viewer
// receives the full trace document without waiting for the lazy bundle.
vi.mock("next/dynamic", () => ({
  default: () =>
    function StubJsonView({ data }: { data: unknown }) {
      return <pre data-testid="raw-json-view">{JSON.stringify(data)}</pre>;
    },
}));

import { TraceRawJsonTab } from "../components/TraceRawJsonTab";

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderTab(fixture: { trace: unknown; spans: unknown }) {
  const trace = fixture.trace as Trace;
  const spans = fixture.spans as Span[];
  render(<TraceRawJsonTab trace={trace} spans={spans} />);
  return { trace, spans };
}

describe("TraceRawJsonTab", () => {
  it("renders the Raw JSON heading and the lazy viewer with the full document", () => {
    const { trace, spans } = renderTab(amieSuccessFixture);
    expect(screen.getByRole("heading", { name: /Raw JSON/i })).toBeInTheDocument();
    const view = screen.getByTestId("raw-json-view");
    const parsed = JSON.parse(view.textContent ?? "{}");
    expect(parsed.trace.trace_id).toBe(trace.trace_id);
    expect(parsed.spans).toHaveLength(spans.length);
  });

  it("copies the full stringified trace document and toasts on success", async () => {
    const { trace, spans } = renderTab(amieSuccessFixture);
    screen.getByRole("button", { name: /Copy JSON/i }).click();
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        JSON.stringify({ trace, spans }, null, 2),
      );
    });
    expect(toastSuccess).toHaveBeenCalledWith("Copied trace JSON");
  });

  it("shows an error toast when the clipboard write rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    renderTab(amieSuccessFixture);
    screen.getByRole("button", { name: /Copy JSON/i }).click();
    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
  });
});
