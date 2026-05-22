import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DrillStack } from "../DrillStack";

describe("DrillStack", () => {
  it("renders title only when crumbs array is empty", () => {
    render(
      <DrillStack open onClose={vi.fn()} title="Drill details" crumbs={[]}>
        <p>Body</p>
      </DrillStack>,
    );
    expect(screen.getByText("Drill details")).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: /breadcrumb/i })).toBeNull();
    expect(screen.getByText("Body")).toBeInTheDocument();
  });

  it("renders N crumbs and pops the right one on click", () => {
    const pop1 = vi.fn();
    const pop2 = vi.fn();
    render(
      <DrillStack
        open
        onClose={vi.fn()}
        title="Top jobs"
        crumbs={[
          { label: "Projects", onPop: pop1 },
          { label: "Acme", onPop: pop2 },
        ]}
      >
        <p>Body</p>
      </DrillStack>,
    );
    const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
    expect(nav).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Acme" }));
    expect(pop2).toHaveBeenCalledTimes(1);
    expect(pop1).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(pop1).toHaveBeenCalledTimes(1);
  });

  it("fires onClose when the SideDrawer close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <DrillStack open onClose={onClose} title="Drill" crumbs={[]}>
        <p>Body</p>
      </DrillStack>,
    );
    fireEvent.click(screen.getByRole("button", { name: /Close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
