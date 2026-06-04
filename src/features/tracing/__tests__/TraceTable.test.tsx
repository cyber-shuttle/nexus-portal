import listFixture from "@features/tracing/__fixtures__/traces.list.fixture.json";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TraceTable } from "../components/TraceTable";
import type { Trace } from "../types";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  toastSuccess.mockReset();
  toastError.mockReset();
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fixtureTraces = listFixture.traces as unknown as Trace[];
const firstTrace = fixtureTraces[0] as Trace;

describe("TraceTable", () => {
  it("renders one row per fixture trace and the expected columns", () => {
    render(
      <TraceTable
        traces={fixtureTraces}
        total={fixtureTraces.length}
        limit={50}
        offset={0}
        loading={false}
        hasFilters={false}
        error={null}
        onPageChange={() => {}}
        onView={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/^Started$/)).toBeInTheDocument();
    expect(screen.getByText(/^Trace ID$/)).toBeInTheDocument();
    expect(screen.getByText(/^Root operation$/)).toBeInTheDocument();
    expect(screen.getByText(/^Source$/)).toBeInTheDocument();
    expect(screen.getByText(/^Duration$/)).toBeInTheDocument();
    expect(screen.getByText(/^Status$/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^View$/ }).length).toBe(fixtureTraces.length);
  });

  it("calls onView with the trace_id when the View button is clicked", () => {
    const onView = vi.fn();
    render(
      <TraceTable
        traces={fixtureTraces}
        total={fixtureTraces.length}
        limit={50}
        offset={0}
        loading={false}
        hasFilters={false}
        error={null}
        onPageChange={() => {}}
        onView={onView}
        onRetry={() => {}}
      />,
    );
    const firstView = screen.getAllByRole("button", { name: /^View$/ })[0] as HTMLElement;
    fireEvent.click(firstView);
    expect(onView).toHaveBeenCalledWith(firstTrace.trace_id);
  });

  it("copies the full trace_id to clipboard and surfaces a toast", async () => {
    render(
      <TraceTable
        traces={fixtureTraces}
        total={fixtureTraces.length}
        limit={50}
        offset={0}
        loading={false}
        hasFilters={false}
        error={null}
        onPageChange={() => {}}
        onView={() => {}}
        onRetry={() => {}}
      />,
    );
    const copyBtn = screen.getByRole("button", {
      name: new RegExp(`Copy trace ID ${firstTrace.trace_id}`),
    });
    fireEvent.click(copyBtn);
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(firstTrace.trace_id);
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
    });
  });

  it("renders an empty state when no traces and no filters", () => {
    render(
      <TraceTable
        traces={[]}
        total={0}
        limit={50}
        offset={0}
        loading={false}
        hasFilters={false}
        error={null}
        onPageChange={() => {}}
        onView={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/no traces yet/i)).toBeInTheDocument();
  });

  it("renders the filtered empty-state copy when filters are active", () => {
    render(
      <TraceTable
        traces={[]}
        total={0}
        limit={50}
        offset={0}
        loading={false}
        hasFilters={true}
        error={null}
        onPageChange={() => {}}
        onView={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByText(/no traces match these filters/i)).toBeInTheDocument();
  });

  it("disables the Next button when offset + limit would exceed the 1M cap", () => {
    render(
      <TraceTable
        traces={fixtureTraces}
        total={2_000_000}
        limit={100}
        offset={999_950}
        loading={false}
        hasFilters={false}
        error={null}
        onPageChange={() => {}}
        onView={() => {}}
        onRetry={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /^Next$/ })).toBeDisabled();
  });
});
