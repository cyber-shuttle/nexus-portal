import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MostUsedResourceCallout } from "../MostUsedResourceCallout";

const rows = [
  { id: "r-cpu", name: "CPU standard", used_su: 1000, share_pct: 50 },
  { id: "r-gpu", name: "GPU A100", used_su: 2000, share_pct: 30 },
  { id: "r-mem", name: "RM 512", used_su: 500, share_pct: 10 },
  { id: "r-fs", name: "Pylon", used_su: 100, share_pct: 5 },
  { id: "r-net", name: "Bridges-net", used_su: 50, share_pct: 3 },
  { id: "r-meta", name: "Meta", used_su: 25, share_pct: 2 },
];

describe("MostUsedResourceCallout", () => {
  it("renders the empty state when no rows are provided", () => {
    render(<MostUsedResourceCallout resources={[]} />);
    expect(screen.getByText(/No resource usage yet/i)).toBeInTheDocument();
  });

  it("renders the top N rows sorted by share desc", () => {
    render(<MostUsedResourceCallout resources={rows} topN={3} />);
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(3);
    // First row should be the highest share — CPU standard at 50%.
    expect(items[0]).toHaveTextContent("CPU standard");
    expect(items[1]).toHaveTextContent("GPU A100");
    expect(items[2]).toHaveTextContent("RM 512");
  });

  it("tiebreaks equal share by raw SUs (heavier rows win)", () => {
    const tied = [
      { id: "a", name: "Alpha", used_su: 100, share_pct: 25 },
      { id: "b", name: "Beta", used_su: 500, share_pct: 25 },
    ];
    render(<MostUsedResourceCallout resources={tied} topN={2} />);
    const list = screen.getByRole("list");
    const items = within(list).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Beta");
    expect(items[1]).toHaveTextContent("Alpha");
  });

  it("displays the percent label in the row", () => {
    render(<MostUsedResourceCallout resources={rows} topN={1} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("displays the raw SU count alongside the percent", () => {
    render(<MostUsedResourceCallout resources={rows} topN={1} />);
    // Number.format renders 1000 -> "1,000"; the cell appends " SU".
    expect(screen.getByText(/1,000 SU/)).toBeInTheDocument();
  });

  it("defaults topN to 5 when not provided", () => {
    render(<MostUsedResourceCallout resources={rows} />);
    const items = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(items).toHaveLength(5);
  });

  it("rank numbers prefix every row", () => {
    render(<MostUsedResourceCallout resources={rows} topN={3} />);
    expect(screen.getByText("1.")).toBeInTheDocument();
    expect(screen.getByText("2.")).toBeInTheDocument();
    expect(screen.getByText("3.")).toBeInTheDocument();
  });
});
