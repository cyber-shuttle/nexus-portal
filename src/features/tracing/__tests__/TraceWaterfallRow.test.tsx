import type { Span } from "@features/tracing/types";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TraceWaterfallRow } from "../components/TraceWaterfallRow";

function makeSpan(over: Partial<Span> = {}): Span {
  return {
    span_id: "1000000000000001",
    name: "amie.process_event:request_account_create",
    kind: 1,
    status: 0,
    start_time: "2026-06-03T14:21:32.500Z",
    end_time: "2026-06-03T14:21:33.000Z",
    ...over,
  };
}

const rootStart = Date.parse("2026-06-03T14:21:32.000Z");
const rootEnd = Date.parse("2026-06-03T14:21:33.000Z");

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TraceWaterfallRow", () => {
  it("indents the row by depth * 16px", () => {
    const span = makeSpan();
    const { container, rerender } = render(
      <TraceWaterfallRow
        span={span}
        depth={0}
        rootStart={rootStart}
        rootEnd={rootEnd}
        isSelected={false}
        onSelect={() => {}}
        siblingP95={0}
      />,
    );
    const row = container.querySelector('[role="treeitem"]') as HTMLElement;
    expect(row.style.paddingLeft).toBe("8px");
    rerender(
      <TraceWaterfallRow
        span={span}
        depth={3}
        rootStart={rootStart}
        rootEnd={rootEnd}
        isSelected={false}
        onSelect={() => {}}
        siblingP95={0}
      />,
    );
    const row2 = container.querySelector('[role="treeitem"]') as HTMLElement;
    expect(row2.style.paddingLeft).toBe("56px");
  });

  it("positions the bar by start offset and width by duration", () => {
    const span = makeSpan({
      start_time: "2026-06-03T14:21:32.250Z",
      end_time: "2026-06-03T14:21:32.750Z",
    });
    const { container } = render(
      <TraceWaterfallRow
        span={span}
        depth={0}
        rootStart={rootStart}
        rootEnd={rootEnd}
        isSelected={false}
        onSelect={() => {}}
        siblingP95={0}
      />,
    );
    const bar = container.querySelector(
      'div[role="treeitem"] span[aria-hidden="true"][style*="left"]',
    ) as HTMLElement;
    // 250ms offset / 1000ms range = 25%; 500ms / 1000ms = 50%.
    expect(bar.style.left).toBe("25%");
    expect(bar.style.width).toBe("50%");
  });

  it("renders different status dot colors for each status code", () => {
    for (const [status, expected] of [
      [0, "var(--nexus-green-500)"],
      [1, "var(--nexus-red-500)"],
      [2, "muted-foreground"],
      [3, "var(--nexus-amber-500)"],
    ] as const) {
      const { container, unmount } = render(
        <TraceWaterfallRow
          span={makeSpan({ status })}
          depth={0}
          rootStart={rootStart}
          rootEnd={rootEnd}
          isSelected={false}
          onSelect={() => {}}
          siblingP95={0}
        />,
      );
      const dot = container.querySelector(
        'div[role="treeitem"] > div:first-child span[aria-hidden="true"]',
      );
      const className = dot?.className ?? "";
      expect(className).toContain(
        typeof expected === "string" && expected.startsWith("var(")
          ? `[color:${expected}]`
          : expected,
      );
      unmount();
    }
  });

  it("calls onSelect with span_id on click", () => {
    const onSelect = vi.fn();
    const span = makeSpan({ span_id: "abcdef0123456789" });
    render(
      <TraceWaterfallRow
        span={span}
        depth={0}
        rootStart={rootStart}
        rootEnd={rootEnd}
        isSelected={false}
        onSelect={onSelect}
        siblingP95={0}
      />,
    );
    const row = screen.getByRole("treeitem");
    row.click();
    expect(onSelect).toHaveBeenCalledWith("abcdef0123456789");
  });

  it("renders the amber slow indicator when duration > siblingP95", () => {
    const span = makeSpan({
      start_time: "2026-06-03T14:21:32.000Z",
      end_time: "2026-06-03T14:21:32.900Z",
    });
    render(
      <TraceWaterfallRow
        span={span}
        depth={0}
        rootStart={rootStart}
        rootEnd={rootEnd}
        isSelected={false}
        onSelect={() => {}}
        siblingP95={100}
      />,
    );
    expect(screen.getByLabelText(/Slow span/i)).toBeInTheDocument();
  });

  it("does not render the slow indicator when siblingP95 is 0", () => {
    render(
      <TraceWaterfallRow
        span={makeSpan()}
        depth={0}
        rootStart={rootStart}
        rootEnd={rootEnd}
        isSelected={false}
        onSelect={() => {}}
        siblingP95={0}
      />,
    );
    expect(screen.queryByLabelText(/Slow span/i)).not.toBeInTheDocument();
  });

  it("sets aria-selected when isSelected is true", () => {
    render(
      <TraceWaterfallRow
        span={makeSpan()}
        depth={0}
        rootStart={rootStart}
        rootEnd={rootEnd}
        isSelected
        onSelect={() => {}}
        siblingP95={0}
      />,
    );
    expect(screen.getByRole("treeitem")).toHaveAttribute("aria-selected", "true");
  });
});
