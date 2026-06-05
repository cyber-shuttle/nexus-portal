import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import { TraceRawTab } from "@features/tracing/components/TraceRawTab";
import type { Span, Trace } from "@features/tracing/types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
});

const trace = amieSuccessFixture.trace as Trace;
const spans = amieSuccessFixture.spans as Span[];

describe("TraceRawTab", () => {
  it("renders the Copy JSON button and span count label", () => {
    render(<TraceRawTab trace={trace} spans={spans} />);
    expect(screen.getByRole("button", { name: /copy trace JSON/i })).toBeInTheDocument();
    expect(screen.getByText(/10 spans/)).toBeInTheDocument();
  });

  it("emits highlighted tokens for keys (syntax-key) and strings (syntax-str)", () => {
    const { container } = render(<TraceRawTab trace={trace} spans={spans} />);
    const pre = container.querySelector('[data-testid="trace-raw-json"]');
    expect(pre).not.toBeNull();
    const keys = pre?.querySelectorAll('[data-token="key"]');
    expect((keys?.length ?? 0)).toBeGreaterThan(0);
    const keyToken = Array.from(keys ?? []).find((el) =>
      (el.getAttribute("style") ?? "").includes("--syntax-key"),
    );
    expect(keyToken).toBeTruthy();
    const strings = pre?.querySelectorAll('[data-token="str"]');
    expect((strings?.length ?? 0)).toBeGreaterThan(0);
  });

  it("copies the stringified JSON to clipboard on click", async () => {
    render(<TraceRawTab trace={trace} spans={spans} />);
    fireEvent.click(screen.getByRole("button", { name: /copy trace JSON/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    const payload = writeText.mock.calls[0]?.[0] as string;
    expect(payload).toContain(`"trace_id": "${trace.trace_id}"`);
    expect(payload).toContain('"span_count":');
  });
});
