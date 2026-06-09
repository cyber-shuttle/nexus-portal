import { StatusPill } from "@features/tracing/components/primitives/StatusPill";
import type { RowTone } from "@features/tracing/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

const TONES: RowTone[] = ["ok", "error", "in-progress", "orphaned", "no-status"];

describe("StatusPill", () => {
  it("renders each tone with a default label", () => {
    for (const tone of TONES) {
      const { unmount } = render(<StatusPill tone={tone} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
      unmount();
    }
  });

  it("dotOnly variant renders only the dot (no label text)", () => {
    render(<StatusPill tone="ok" dotOnly />);
    const node = screen.getByRole("status");
    expect(node).toHaveAttribute("aria-label", "Status: ok");
    expect(node.textContent ?? "").toBe("");
  });

  it("applies the pulsing class for in-progress", () => {
    const { container } = render(<StatusPill tone="in-progress" />);
    expect(container.querySelector(".nexus-pulse-dot")).not.toBeNull();
  });

  it("does not apply the pulsing class for non-in-progress tones", () => {
    const { container } = render(<StatusPill tone="ok" />);
    expect(container.querySelector(".nexus-pulse-dot")).toBeNull();
  });

  it("uses a custom label when provided", () => {
    render(<StatusPill tone="error" label="failed" />);
    expect(screen.getByText("failed")).toBeInTheDocument();
  });
});
