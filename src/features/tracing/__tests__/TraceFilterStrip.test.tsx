import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_FILTERS,
  type ListFilters,
  TraceFilterStrip,
} from "../components/TraceFilterStrip";

afterEach(() => {
  vi.useRealTimers();
});

describe("TraceFilterStrip", () => {
  it("renders status, source, and window controls with defaults", () => {
    render(<TraceFilterStrip value={DEFAULT_FILTERS} onChange={() => {}} />);
    expect(screen.getByText(/^status$/i)).toBeInTheDocument();
    expect(screen.getByText(/^source$/i)).toBeInTheDocument();
    expect(screen.getByText(/^window$/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^ok$/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /^30d$/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles a status chip and emits the updated filter", () => {
    const onChange = vi.fn();
    render(<TraceFilterStrip value={DEFAULT_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^error$/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: [1], offset: 0 }));
  });

  it("toggles a source chip and emits the updated filter", () => {
    const onChange = vi.fn();
    render(<TraceFilterStrip value={DEFAULT_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^amie$/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ source: ["amie"], offset: 0 }));
  });

  it("switches preset on click", () => {
    const onChange = vi.fn();
    render(<TraceFilterStrip value={DEFAULT_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^7d$/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ preset: "7d", from: undefined, to: undefined }),
    );
  });

  it("shows date inputs when preset is custom", () => {
    const value: ListFilters = { ...DEFAULT_FILTERS, preset: "custom" };
    render(<TraceFilterStrip value={value} onChange={() => {}} />);
    expect(screen.getByLabelText(/^from$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^to$/i)).toBeInTheDocument();
  });

  it("warns when custom range exceeds 365 days", () => {
    const value: ListFilters = {
      ...DEFAULT_FILTERS,
      preset: "custom",
      from: "2024-01-01T00:00:00.000Z",
      to: "2026-01-01T00:00:00.000Z",
    };
    render(<TraceFilterStrip value={value} onChange={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot exceed 365 days/i);
  });

  it("debounces free-text input before emitting", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<TraceFilterStrip value={DEFAULT_FILTERS} onChange={onChange} />);
    const search = screen.getByPlaceholderText(/trace_id, span_id, or operation/i);
    fireEvent.change(search, { target: { value: "alice" } });
    expect(onChange).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(350);
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ q: "alice", offset: 0 }));
  });
});
