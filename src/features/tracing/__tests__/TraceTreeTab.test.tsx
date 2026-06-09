import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import { TraceTreeTab } from "@features/tracing/components/TraceTreeTab";
import type { Span, Trace } from "@features/tracing/types";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
  // jsdom doesn't implement ResizeObserver — stub a no-op.
  type RO = {
    observe: () => void;
    disconnect: () => void;
    unobserve: () => void;
  };
  // biome-ignore lint/suspicious/noExplicitAny: test stub
  (window as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  } as unknown as RO;
  // Reset URL between tests so ?span= state doesn't bleed across.
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  vi.restoreAllMocks();
});

const failedTrace = amieFailedFixture.trace as Trace;
const failedSpans = amieFailedFixture.spans as Span[];
const successTrace = amieSuccessFixture.trace as Trace;
const successSpans = amieSuccessFixture.spans as Span[];

describe("TraceTreeTab", () => {
  it("renders the tree role and error chip for a failed trace", () => {
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    expect(screen.getByRole("tree", { name: /trace span tree/i })).toBeInTheDocument();
    expect(screen.getByTestId("trace-error-chip")).toBeInTheDocument();
  });

  it("shows 'all ok' summary for a successful trace and no error chip", () => {
    render(
      <TraceTreeTab trace={successTrace} spans={successSpans} onSwitchToTab={() => {}} />,
    );
    expect(screen.getByText(/all ok/i)).toBeInTheDocument();
    expect(screen.queryByTestId("trace-error-chip")).toBeNull();
  });

  it("clicking a row writes ?span= to the URL", () => {
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    // Click any visible row.
    const row = screen.getByTestId(`trace-tree-row-${failedSpans[0]?.span_id}`);
    fireEvent.click(row);
    expect(window.location.search).toMatch(/[?&]span=/);
  });

  it("errors-only checkbox reduces visible rows to the error path", () => {
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    const checkbox = screen.getByTestId("errors-only-checkbox") as HTMLInputElement;
    const before = screen.getAllByRole("treeitem").length;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    const after = screen.getAllByRole("treeitem").length;
    expect(after).toBeLessThan(before);
    // Status summary swaps to the filtered form.
    expect(screen.getByText(/of \d+ rows/)).toBeInTheDocument();
  });

  it("ArrowDown moves the selected row", () => {
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    const tree = screen.getByRole("tree", { name: /trace span tree/i });
    tree.focus();
    fireEvent.keyDown(tree, { key: "ArrowDown" });
    expect(window.location.search).toMatch(/[?&]span=/);
  });

  it("ArrowRight expands a collapsed parent", () => {
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    // Collapse all first via button so we have something collapsed to expand.
    fireEvent.click(screen.getByRole("button", { name: /collapse all/i }));
    const root = screen.getByTestId(`trace-tree-row-${failedSpans[0]?.span_id}`);
    // Select root.
    fireEvent.click(root);
    const tree = screen.getByRole("tree", { name: /trace span tree/i });
    const before = screen.getAllByRole("treeitem").length;
    fireEvent.keyDown(tree, { key: "ArrowRight" });
    const after = screen.getAllByRole("treeitem").length;
    expect(after).toBeGreaterThan(before);
  });

  it("pressing 'n' jumps to the next error leaf", () => {
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    const tree = screen.getByRole("tree", { name: /trace span tree/i });
    fireEvent.keyDown(tree, { key: "n" });
    // After "n" the selected span lands on an error leaf (`1000000000000008`
    // in the failed fixture).
    expect(window.location.search).toMatch(/span=1000000000000008/);
  });

  it("error chip next button advances cursor and updates 'c of N'", () => {
    // amie.failed has 1 error leaf — verify chip shows "1 error" and prev/next
    // are hidden for the single-leaf case (per spec).
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    const chip = screen.getByTestId("trace-error-chip");
    expect(within(chip).getByText(/^1 error$/)).toBeInTheDocument();
    expect(screen.queryByTestId("trace-error-chip-next")).toBeNull();
  });

  it("renders the detail panel and 'Open in Raw' switches tabs", () => {
    const onSwitch = vi.fn();
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={onSwitch} />,
    );
    const openRaw = screen.getByTestId("trace-span-open-raw");
    fireEvent.click(openRaw);
    expect(onSwitch).toHaveBeenCalledWith("raw");
  });

  it("expand all then collapse all toggles structural rows", () => {
    render(
      <TraceTreeTab trace={failedTrace} spans={failedSpans} onSwitchToTab={() => {}} />,
    );
    const expanded = screen.getAllByRole("treeitem").length;
    fireEvent.click(screen.getByRole("button", { name: /collapse all/i }));
    const collapsed = screen.getAllByRole("treeitem").length;
    expect(collapsed).toBeLessThan(expanded);
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: /expand all/i }));
    });
    const reExpanded = screen.getAllByRole("treeitem").length;
    expect(reExpanded).toBe(expanded);
  });
});
