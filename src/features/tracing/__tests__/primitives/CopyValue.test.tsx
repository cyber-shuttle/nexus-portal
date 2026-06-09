import { CopyValue } from "@features/tracing/components/primitives/CopyValue";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("CopyValue", () => {
  const writeText = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.assign(navigator, { clipboard: { writeText } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writes to the clipboard on click and stops propagation", () => {
    const onParentClick = vi.fn();
    render(
      <button type="button" onClick={onParentClick}>
        <CopyValue value="trace-abc" label="trace ID" />
      </button>,
    );
    const btn = screen.getByRole("button", { name: "Copy trace ID" });
    fireEvent.click(btn);
    expect(writeText).toHaveBeenCalledWith("trace-abc");
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("swaps to the check icon for 1.1s then reverts to copy", async () => {
    const { container } = render(<CopyValue value="trace-abc" />);
    const btn = screen.getByRole("button", { name: "Copy trace-abc" });
    fireEvent.click(btn);
    // Microtask: writeText resolves, setCopied(true) commits, icon swaps.
    await waitFor(() => {
      expect(container.querySelector("svg.lucide-check")).not.toBeNull();
    });
    expect(container.querySelector("svg.lucide-copy")).toBeNull();

    // Real-timer wait — keep it tight (1500ms > the 1100ms reset). Using fake
    // timers here fights the React 18 commit boundary and is flakier than the
    // direct waitFor.
    await waitFor(
      () => {
        expect(container.querySelector("svg.lucide-check")).toBeNull();
      },
      { timeout: 1500 },
    );
    expect(container.querySelector("svg.lucide-copy")).not.toBeNull();
  });
});
