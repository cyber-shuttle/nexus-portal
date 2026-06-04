import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import type { Span } from "@features/tracing/types";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let currentSearch = new URLSearchParams();
let historyReplace: ReturnType<typeof vi.spyOn>;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => currentSearch,
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function StubJsonView({ data }: { data: unknown }) {
      return <pre data-testid="payload-json">{JSON.stringify(data)}</pre>;
    },
}));

import { TraceWaterfallTab } from "../components/TraceWaterfallTab";

// Pull the new URL out of a window.history.replaceState call. JSDOM follows
// the spec signature: (state, unused, url?).
function lastHistoryUrl(spy: ReturnType<typeof vi.spyOn>): string {
  const calls = spy.mock.calls;
  const last = calls[calls.length - 1] ?? [];
  return String((last as unknown[])[2] ?? "");
}

beforeEach(() => {
  replace.mockReset();
  currentSearch = new URLSearchParams();
  Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  window.history.replaceState({}, "", "/admin/traces");
  historyReplace = vi.spyOn(window.history, "replaceState");
});

afterEach(() => {
  historyReplace.mockRestore();
  vi.restoreAllMocks();
});

function makeSyntheticSpans(count: number): Span[] {
  const rootStart = Date.parse("2026-06-03T14:00:00.000Z");
  return Array.from({ length: count }, (_, i) => {
    const start = new Date(rootStart + i * 10).toISOString();
    const end = new Date(rootStart + i * 10 + 5).toISOString();
    return {
      span_id: i.toString(16).padStart(16, "0"),
      name: `span.${i}`,
      kind: 0,
      status: 0,
      start_time: start,
      end_time: end,
    } as Span;
  });
}

describe("TraceWaterfallTab", () => {
  it("renders retry roots as sibling subtrees, not as children of the original root", () => {
    const { trace, spans } = amieFailedFixture;
    render(
      <TraceWaterfallTab
        spans={spans as unknown as Span[]}
        rootStart={trace.started_at}
        rootEnd={trace.ended_at}
      />,
    );
    const list = screen.getByRole("tree", { name: /Span waterfall/i });
    const retryRow = within(list).getByText(/^retry:amie.process_event/);
    // The retry row sits in a treeitem div; its aria-level is 1 (depth 0 + 1)
    // because retry roots lift to top-level siblings of the original root.
    const row = retryRow.closest('[role="treeitem"]') as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.getAttribute("aria-level")).toBe("1");
  });

  it("renders all expected spans from the AMIE failed fixture", () => {
    const { trace, spans } = amieFailedFixture;
    render(
      <TraceWaterfallTab
        spans={spans as unknown as Span[]}
        rootStart={trace.started_at}
        rootEnd={trace.ended_at}
      />,
    );
    const list = screen.getByRole("tree", { name: /Span waterfall/i });
    expect(within(list).getAllByRole("treeitem").length).toBe(spans.length);
  });

  it("writes ?span=<id> via shallow history on row click", () => {
    const { trace, spans } = amieFailedFixture;
    render(
      <TraceWaterfallTab
        spans={spans as unknown as Span[]}
        rootStart={trace.started_at}
        rootEnd={trace.ended_at}
      />,
    );
    const rows = screen.getAllByRole("treeitem");
    rows[1]?.click();
    expect(historyReplace).toHaveBeenCalled();
    expect(lastHistoryUrl(historyReplace)).toMatch(/span=/);
  });

  it("moves selection via ArrowDown/ArrowUp keys", () => {
    const { trace, spans } = amieFailedFixture;
    render(
      <TraceWaterfallTab
        spans={spans as unknown as Span[]}
        rootStart={trace.started_at}
        rootEnd={trace.ended_at}
      />,
    );
    const rows = screen.getAllByRole("treeitem");
    rows[0]?.focus();
    fireEvent.keyDown(rows[0] as HTMLElement, { key: "ArrowDown" });
    expect(historyReplace).toHaveBeenCalled();
    const url = new URL(lastHistoryUrl(historyReplace), "http://localhost");
    expect(url.searchParams.get("span")).toBeTruthy();
  });

  it("clears selection on ArrowLeft", () => {
    const { trace, spans } = amieFailedFixture;
    render(
      <TraceWaterfallTab
        spans={spans as unknown as Span[]}
        rootStart={trace.started_at}
        rootEnd={trace.ended_at}
      />,
    );
    // Without a `?span=` in the URL the drill panel stays closed, so the rows
    // are still queryable. ArrowLeft writes a new URL without `span=`.
    const rows = screen.getAllByRole("treeitem");
    rows[0]?.focus();
    fireEvent.keyDown(rows[0] as HTMLElement, { key: "ArrowLeft" });
    expect(historyReplace).toHaveBeenCalled();
    expect(lastHistoryUrl(historyReplace)).not.toContain("span=");
  });

  it("renders EmptyState when spans is empty", () => {
    render(
      <TraceWaterfallTab
        spans={[]}
        rootStart="2026-06-03T14:00:00.000Z"
        rootEnd="2026-06-03T14:00:01.000Z"
      />,
    );
    expect(screen.getByText(/No spans in this trace/i)).toBeInTheDocument();
  });

  it("renders first 200 rows and a Load more button for >200 spans", () => {
    const spans = makeSyntheticSpans(350);
    const { rerender } = render(
      <TraceWaterfallTab
        spans={spans}
        rootStart={spans[0]?.start_time as string}
        rootEnd={spans[spans.length - 1]?.end_time as string}
      />,
    );
    expect(screen.getAllByRole("treeitem").length).toBe(200);
    const loadMore = screen.getByRole("button", { name: /\+150 more rows — Load more/ });
    expect(loadMore).toBeInTheDocument();
    act(() => loadMore.click());
    // Force the rerender to flush the post-click state update.
    rerender(
      <TraceWaterfallTab
        spans={spans}
        rootStart={spans[0]?.start_time as string}
        rootEnd={spans[spans.length - 1]?.end_time as string}
      />,
    );
    expect(screen.getAllByRole("treeitem").length).toBe(350);
  });

  it(
    "hard caps rendering and shows '+N more not shown' for >5000 spans",
    { timeout: 30_000 },
    () => {
      // Render exactly HARD_CAP+5 rows by pre-revealing far enough — synthetic
      // spans are cheap but the rendered row count is what matters. We assert
      // the visible cap holds and the muted overflow text appears.
      const spans = makeSyntheticSpans(5005);
      render(
        <TraceWaterfallTab
          spans={spans}
          rootStart={spans[0]?.start_time as string}
          rootEnd={spans[spans.length - 1]?.end_time as string}
        />,
      );
      // Walk the Load more button forward; the count strictly decreases.
      let guard = 30;
      while (guard-- > 0) {
        const btn = screen.queryByRole("button", { name: /Load more/ });
        if (!btn) break;
        act(() => btn.click());
      }
      expect(screen.getAllByRole("treeitem").length).toBe(5000);
      expect(screen.getByText(/\+5 more not shown/)).toBeInTheDocument();
    },
  );

  it("marks a sibling as slow when its duration exceeds the sibling P95", () => {
    // Three top-level siblings: two fast (10ms), one slow (1000ms). P95
    // sits between them so only the slow span renders the amber indicator.
    const base = Date.parse("2026-06-03T14:00:00.000Z");
    const mk = (i: number, dur: number): Span => ({
      span_id: i.toString(16).padStart(16, "0"),
      name: `s${i}`,
      kind: 0,
      status: 0,
      start_time: new Date(base + i * 100).toISOString(),
      end_time: new Date(base + i * 100 + dur).toISOString(),
    });
    const spans: Span[] = [mk(1, 10), mk(2, 10), mk(3, 1000)];
    render(
      <TraceWaterfallTab
        spans={spans}
        rootStart={spans[0]?.start_time as string}
        rootEnd={spans[2]?.end_time as string}
      />,
    );
    expect(screen.getAllByLabelText(/Slow span/i).length).toBeGreaterThan(0);
  });

  it("scrolls the matching row into view when scrollToSpanId is set", () => {
    const { trace, spans } = amieFailedFixture;
    const targetId = spans[2]?.span_id as string;
    render(
      <TraceWaterfallTab
        spans={spans as unknown as Span[]}
        rootStart={trace.started_at}
        rootEnd={trace.ended_at}
        scrollToSpanId={targetId}
      />,
    );
    // scrollIntoView is mocked in beforeEach; assert it fired at least once
    // with `block: 'nearest'`.
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({
      block: "nearest",
    });
    // And it sets the selection (shallow history write contains ?span=<targetId>).
    expect(historyReplace).toHaveBeenCalled();
    expect(lastHistoryUrl(historyReplace)).toContain(`span=${targetId}`);
  });
});
