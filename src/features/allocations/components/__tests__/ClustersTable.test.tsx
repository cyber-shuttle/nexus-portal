import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Cluster } from "../../schemas";
import { ClustersTable } from "../ClustersTable";

const enabledRow: Cluster = {
  id: "cluster-001",
  name: "Bridges-2",
  status: "ENABLED",
  type: "Compute",
  location: "PSC",
  allocation_count: 47,
  user_count: 213,
};

const disabledRow: Cluster = {
  id: "cluster-003",
  name: "Nexus-Legacy",
  status: "DISABLED",
  type: "Compute",
  location: "Legacy",
  allocation_count: 5,
  user_count: 12,
};

function baseProps(overrides: Partial<React.ComponentProps<typeof ClustersTable>> = {}) {
  return {
    rows: [enabledRow, disabledRow],
    isLoading: false,
    error: null,
    statusFilter: "" as const,
    typeFilter: "",
    q: "",
    onStatusChange: vi.fn(),
    onTypeChange: vi.fn(),
    onQueryChange: vi.fn(),
    onToggle: vi.fn().mockResolvedValue(undefined),
    canManage: true,
    onRetry: vi.fn(),
    ...overrides,
  };
}

describe("ClustersTable", () => {
  it("renders one row per cluster with an EnableToggle in the status column", () => {
    render(<ClustersTable {...baseProps()} />);
    expect(screen.getByText("Bridges-2")).toBeInTheDocument();
    expect(screen.getByText("Nexus-Legacy")).toBeInTheDocument();
    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[1]).toHaveAttribute("aria-checked", "false");
  });

  it("applies the muted treatment to DISABLED rows so the visual reads as inactive", () => {
    render(<ClustersTable {...baseProps()} />);
    const disabled = screen.getByTestId(`cluster-row-${disabledRow.id}`);
    expect(disabled.className).toMatch(/opacity-70/);
    const enabled = screen.getByTestId(`cluster-row-${enabledRow.id}`);
    expect(enabled.className).not.toMatch(/opacity-70/);
  });

  it("CASL gate: non-admins see the toggle in read-only state", () => {
    render(<ClustersTable {...baseProps({ canManage: false })} />);
    const switches = screen.getAllByRole("switch");
    for (const sw of switches) {
      expect(sw).toBeDisabled();
      expect(sw.getAttribute("aria-label")).toMatch(/read-only/);
    }
  });

  it("status filter dropdown change calls onStatusChange with the picked value", () => {
    const onStatusChange = vi.fn();
    render(<ClustersTable {...baseProps({ onStatusChange })} />);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "DISABLED" } });
    expect(onStatusChange).toHaveBeenCalledWith("DISABLED");
  });

  it("filters rows locally by status when the filter is set", () => {
    render(<ClustersTable {...baseProps({ statusFilter: "ENABLED" })} />);
    expect(screen.getByText("Bridges-2")).toBeInTheDocument();
    expect(screen.queryByText("Nexus-Legacy")).not.toBeInTheDocument();
  });

  it("clicking an ENABLED row's toggle opens the impact dialog and confirm fires onToggle", async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined);
    render(<ClustersTable {...baseProps({ onToggle })} />);
    const firstSwitch = screen.getAllByRole("switch")[0];
    if (!firstSwitch) throw new Error("expected a switch in the row");
    fireEvent.click(firstSwitch);

    // Dialog renders the impact numbers from the row — scope inside the
    // dialog so we don't collide with the same numbers in the table cells.
    expect(screen.getByText(/Disable Bridges-2\?/)).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("47")).toBeInTheDocument();
    expect(within(dialog).getByText("213")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Disable" }));
    await vi.waitFor(() => expect(onToggle).toHaveBeenCalledTimes(1));
    expect(onToggle).toHaveBeenCalledWith(enabledRow, false);
  });

  it("renders the empty-state when no rows match the active filter", () => {
    render(<ClustersTable {...baseProps({ rows: [enabledRow], statusFilter: "DISABLED" })} />);
    expect(screen.getByText(/No clusters match these filters/i)).toBeInTheDocument();
  });

  it("renders the error state with retry when load fails", () => {
    const onRetry = vi.fn();
    render(
      <ClustersTable
        {...baseProps({
          rows: [],
          error: new Error("boom"),
          onRetry,
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});
