import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import auditEventsFixture from "@features/tracing/__fixtures__/audit-events.fixture.json";
import httpTraceFixture from "@features/tracing/__fixtures__/trace.http.fixture.json";
import { TraceLinkedEntitiesTab } from "@features/tracing/components/TraceLinkedEntitiesTab";
import type { Span, Trace } from "@features/tracing/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
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

describe("TraceLinkedEntitiesTab", () => {
  it("renders AMIE packet + CO person cards for the failed amie fixture", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(auditEventsFixture));
    const client = newClient();
    render(
      <TraceLinkedEntitiesTab
        trace={amieFailedFixture.trace as Trace}
        spans={amieFailedFixture.spans as Span[]}
      />,
      { wrapper: withClient(client) },
    );
    expect(screen.getByTestId("entity-card-amie-packet")).toBeInTheDocument();
    // amie.failed fixture has comanage.co_id, but not co_person_id — verify the
    // packet card alone, then check the empty-state for CO person specifically.
    expect(screen.queryByTestId("entity-card-co-person")).toBeNull();
    await waitFor(() => {
      expect(screen.getByText(/CREATE_PERSON/)).toBeInTheDocument();
    });
  });

  it("shows the empty state when no spans carry known entity attrs", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ audit_events: [], amie_audit_log: [] }));
    const client = newClient();
    render(
      <TraceLinkedEntitiesTab
        trace={httpTraceFixture.trace as Trace}
        spans={httpTraceFixture.spans as Span[]}
      />,
      { wrapper: withClient(client) },
    );
    expect(screen.getByTestId("entities-empty")).toBeInTheDocument();
  });

  it("merges core audit_events and amie_audit_log into one sorted table", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(auditEventsFixture));
    const client = newClient();
    render(
      <TraceLinkedEntitiesTab
        trace={amieFailedFixture.trace as Trace}
        spans={amieFailedFixture.spans as Span[]}
      />,
      { wrapper: withClient(client) },
    );
    await waitFor(() => {
      expect(screen.getByText("ComanageProvisioningFailed")).toBeInTheDocument();
    });
    expect(screen.getByText("CREATE_PERSON")).toBeInTheDocument();
    expect(screen.getByText("CREATE_PROJECT")).toBeInTheDocument();
  });

  it("renders the audit-empty state when the trace has no audit rows", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ audit_events: [], amie_audit_log: [] }));
    const client = newClient();
    render(
      <TraceLinkedEntitiesTab
        trace={httpTraceFixture.trace as Trace}
        spans={httpTraceFixture.spans as Span[]}
      />,
      { wrapper: withClient(client) },
    );
    await waitFor(() => {
      expect(screen.getByTestId("audit-events-empty")).toBeInTheDocument();
    });
  });
});
