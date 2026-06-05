import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import amieSuccessFixture from "@features/tracing/__fixtures__/trace.amie.success.fixture.json";
import auditEventsFixture from "@features/tracing/__fixtures__/audit-events.fixture.json";
import { TraceDetailDrawer } from "@features/tracing/components/TraceDetailDrawer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function withClient(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

describe("TraceDetailDrawer", () => {
  it("does not fetch when open=false", () => {
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieSuccessFixture.trace.trace_id}
        open={false}
        onClose={() => {}}
      />,
      { wrapper: withClient(client) },
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the trace when open=true and renders the four tabs", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(amieSuccessFixture));
    fetchMock.mockResolvedValueOnce(jsonResponse({ audit_events: [], amie_audit_log: [] }));
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieSuccessFixture.trace.trace_id}
        open
        onClose={() => {}}
      />,
      { wrapper: withClient(client) },
    );
    await waitFor(() => {
      expect(screen.getByText(/^Overview$/)).toBeInTheDocument();
    });
    expect(screen.getByText(/^Tree \(10\)$/)).toBeInTheDocument();
    expect(screen.getByText(/^Raw$/)).toBeInTheDocument();
    expect(screen.getByText(/^Linked entities$/)).toBeInTheDocument();
  });

  it("Tree tab is the default and mounts the span tree", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(amieSuccessFixture));
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieSuccessFixture.trace.trace_id}
        open
        onClose={() => {}}
      />,
      { wrapper: withClient(client) },
    );
    await waitFor(() => {
      expect(screen.getByRole("tree", { name: /trace span tree/i })).toBeInTheDocument();
    });
  });

  it("Esc keypress fires onClose", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(amieSuccessFixture));
    const onClose = vi.fn();
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieSuccessFixture.trace.trace_id}
        open
        onClose={onClose}
      />,
      { wrapper: withClient(client) },
    );
    await waitFor(() => {
      expect(screen.getByTestId("trace-detail-drawer")).toBeInTheDocument();
    });
    fireEvent.keyDown(document.body, { key: "Escape" });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("renders the error summary line for failed traces", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(amieFailedFixture));
    fetchMock.mockResolvedValueOnce(jsonResponse(auditEventsFixture));
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieFailedFixture.trace.trace_id}
        open
        onClose={() => {}}
      />,
      { wrapper: withClient(client) },
    );
    await waitFor(() => {
      expect(screen.getByText(/at span/)).toBeInTheDocument();
    });
  });

  it("retry button is aria-disabled with the coming-soon aria-label", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(amieSuccessFixture));
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieSuccessFixture.trace.trace_id}
        open
        onClose={() => {}}
      />,
      { wrapper: withClient(client) },
    );
    const btn = await screen.findByTestId("retry-tooltip-anchor");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(btn.getAttribute("aria-label")).toMatch(/disabled — coming soon/);
  });

  it("renders the loading skeleton before data arrives", () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieSuccessFixture.trace.trace_id}
        open
        onClose={() => {}}
      />,
      { wrapper: withClient(client) },
    );
    // The drawer renders into a portal; query the document root.
    expect(document.querySelector('[data-slot="skeleton"]')).not.toBeNull();
  });

  it("renders the error state when the fetch fails", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "trace not found" }), { status: 404 }),
    );
    const client = newClient();
    render(
      <TraceDetailDrawer
        traceId={amieSuccessFixture.trace.trace_id}
        open
        onClose={() => {}}
      />,
      { wrapper: withClient(client) },
    );
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
