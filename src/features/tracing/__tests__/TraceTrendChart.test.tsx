import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TraceTrendChart, pivotByDay } from "../components/TraceTrendChart";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function wrap(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

describe("pivotByDay", () => {
  it("pivots flat (date,status) rows into one row per date with status keys", () => {
    const pivoted = pivotByDay([
      { date: "2026-05-05", status: 0, count: 12 },
      { date: "2026-05-05", status: 1, count: 1 },
      { date: "2026-05-06", status: 0, count: 18 },
    ]);
    expect(pivoted).toEqual([
      { date: "2026-05-05", "0": 12, "1": 1, "2": 0, "3": 0 },
      { date: "2026-05-06", "0": 18, "1": 0, "2": 0, "3": 0 },
    ]);
  });

  it("sorts rows by date ascending", () => {
    const pivoted = pivotByDay([
      { date: "2026-05-07", status: 0, count: 22 },
      { date: "2026-05-05", status: 0, count: 12 },
    ]);
    expect(pivoted.map((r) => r.date)).toEqual(["2026-05-05", "2026-05-07"]);
  });

  it("returns an empty array for empty input", () => {
    expect(pivotByDay([])).toEqual([]);
  });
});

describe("TraceTrendChart rendering", () => {
  it("shows skeleton while loading", () => {
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<TraceTrendChart />, {
      wrapper: wrap(newClient()),
    });
    expect(container.querySelector('[data-slot="skeleton"]')).toBeTruthy();
  });

  it("renders error state with a Retry button on failure", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    render(<TraceTrendChart />, { wrapper: wrap(newClient()) });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("renders the empty-state copy when byDay is empty", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ byDay: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    render(<TraceTrendChart />, { wrapper: wrap(newClient()) });
    expect(await screen.findByText(/No data in the last 30 days/i)).toBeInTheDocument();
  });
});
