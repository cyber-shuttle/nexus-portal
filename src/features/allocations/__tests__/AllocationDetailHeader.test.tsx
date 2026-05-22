import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  AllocationDetailHeader,
  buildHeaderResources,
} from "../components/AllocationDetailHeader";
import type { ComputeAllocation, ComputeAllocationResource } from "../schemas";

const baseAllocation: ComputeAllocation = {
  id: "alloc-1",
  project_id: "proj-1",
  name: "SimVascular Super Computing Gateway",
  status: "ACTIVE",
  compute_cluster_id: "cluster-1",
  initial_su_amount: 500_000,
  start_time: "2026-01-01T00:00:00.000Z",
  end_time: "2099-11-06T00:00:00.000Z",
};

describe("AllocationDetailHeader", () => {
  it("renders the title, MetaRow facts, and a 3-up StatCardRow", () => {
    render(
      <AllocationDetailHeader
        allocation={baseAllocation}
        piName="Eroma Abeysinghe"
        memberCount={4}
        resources={[
          { id: "r1", name: "Bridges-2 RM", used: 120, total: 200 },
          { id: "r2", name: "Anvil CPU", used: 60, total: 100 },
        ]}
        remainingCredits={324_241}
        updatedAt={Date.now()}
      />,
    );

    // Title is the page-level h1.
    expect(
      screen.getByRole("heading", { level: 1, name: /SimVascular Super Computing Gateway/i }),
    ).toBeInTheDocument();

    // MetaRow facts.
    expect(screen.getByText(/Active/)).toBeInTheDocument();
    expect(screen.getByText(/Eroma Abeysinghe/)).toBeInTheDocument();
    expect(screen.getByText(/End date/)).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    // Credits card.
    expect(screen.getByText(/Remaining ACCESS credits/i)).toBeInTheDocument();
    expect(screen.getByText("324,241")).toBeInTheDocument();

    // Resource progress cards.
    expect(screen.getByText("Bridges-2 RM")).toBeInTheDocument();
    expect(screen.getByText(/120\/200 hrs/)).toBeInTheDocument();
    expect(screen.getByText("Anvil CPU")).toBeInTheDocument();
  });

  it("renders an em-dash for PI when not available", () => {
    render(
      <AllocationDetailHeader
        allocation={baseAllocation}
        piName={null}
        memberCount={0}
        resources={[]}
        remainingCredits={0}
        updatedAt={null}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("caps the resource row at two cards even with more resources passed", () => {
    const { container } = render(
      <AllocationDetailHeader
        allocation={baseAllocation}
        piName="X"
        memberCount={1}
        resources={[
          { id: "r1", name: "A", used: 1, total: 10 },
          { id: "r2", name: "B", used: 2, total: 10 },
          { id: "r3", name: "C", used: 3, total: 10 },
        ]}
        remainingCredits={1}
        updatedAt={null}
      />,
    );
    // Credits card + 2 resource cards = 3-up.
    const grid = container.querySelector(".md\\:grid-cols-3") as HTMLElement;
    expect(grid).not.toBeNull();
    expect(within(grid).queryByText("C")).toBeNull();
    expect(within(grid).getByText("A")).toBeInTheDocument();
    expect(within(grid).getByText("B")).toBeInTheDocument();
  });

  it("flags an Active allocation past its end date as Expired", () => {
    const expired: ComputeAllocation = {
      ...baseAllocation,
      end_time: "2020-01-01T00:00:00.000Z",
    };
    render(
      <AllocationDetailHeader
        allocation={expired}
        piName="X"
        memberCount={0}
        resources={[]}
        remainingCredits={0}
        updatedAt={null}
      />,
    );
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });
});

describe("buildHeaderResources", () => {
  it("joins resources with the usedByResource map and falls back to zero", () => {
    const resources: ComputeAllocationResource[] = [
      { id: "r1", name: "A", resource_type: "CPU", resource_amount: 100 },
      { id: "r2", name: "B", resource_type: "GPU", resource_amount: 50 },
    ];
    const used = new Map<string, number>([["r1", 25]]);
    const out = buildHeaderResources(resources, used);
    expect(out).toEqual([
      { id: "r1", name: "A", used: 25, total: 100 },
      { id: "r2", name: "B", used: 0, total: 50 },
    ]);
  });
});
