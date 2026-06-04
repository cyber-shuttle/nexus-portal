import auditEventsFixture from "@features/tracing/__fixtures__/audit-events.fixture.json";
import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import httpFixture from "@features/tracing/__fixtures__/trace.http.fixture.json";
import orphanedFixture from "@features/tracing/__fixtures__/trace.orphaned.fixture.json";
import type { Span, Trace } from "@features/tracing/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { TraceLinkedEntitiesTab } from "../components/TraceLinkedEntitiesTab";

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

function renderTab(fixture: { trace: unknown; spans: unknown }) {
  const trace = fixture.trace as Trace;
  const spans = fixture.spans as Span[];
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  const utils = render(
    <QueryClientProvider client={client}>
      <TraceLinkedEntitiesTab trace={trace} spans={spans} />
    </QueryClientProvider>,
  );
  return { trace, spans, ...utils };
}

describe("TraceLinkedEntitiesTab", () => {
  it("renders AMIE Packet and COmanage Person cards for the amie.failed fixture", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(auditEventsFixture));
    renderTab(amieFailedFixture);
    expect(screen.getByText(/AMIE Packet/i)).toBeInTheDocument();
    expect(screen.getByText(/COmanage Person/i)).toBeInTheDocument();
    expect(screen.getByText("pkt-2")).toBeInTheDocument();
    expect(screen.getByText("evt-2")).toBeInTheDocument();
    const openPacket = screen.getByRole("link", { name: /Open packet/i });
    expect(openPacket).toHaveAttribute("href", "/admin/amie/packets/pkt-2");
    // Wait for the audit-events query to land so the test cleans up neatly.
    await waitFor(() => {
      expect(screen.getByText(/ComanageProvisioningFailed/)).toBeInTheDocument();
    });
  });

  it("hides comanage.email by default and reveals it after the Show contact info toggle", () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(auditEventsFixture));
    renderTab(amieFailedFixture);
    // <details> is closed by default, so the email is not in the visible flow.
    const summary = screen.getByText(/Show contact info/i);
    const details = summary.closest("details");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
    // After opening, the email becomes visible.
    if (details) details.open = true;
    expect(screen.getByText("alice@example.org")).toBeInTheDocument();
  });

  it("renders only the HTTP request card for the http fixture", () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ audit_events: [], amie_audit_log: [] }));
    renderTab(httpFixture);
    expect(screen.getByText(/HTTP request/i)).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("/users")).toBeInTheDocument();
    expect(screen.queryByText(/AMIE Packet/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/COmanage Person/i)).not.toBeInTheDocument();
  });

  it("renders empty state when no attributes carry entity references and audit is empty", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ audit_events: [], amie_audit_log: [] }));
    // Strip every attribute so the extractor finds nothing — the orphaned
    // fixture carries a slurm.cluster_id which would otherwise surface a card.
    const stripped = {
      trace: orphanedFixture.trace,
      spans: orphanedFixture.spans.map((s) => ({ ...s, attributes: null })),
    };
    renderTab(stripped);
    expect(screen.getByText("No linked entities.")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("No audit events written under this trace.")).toBeInTheDocument();
    });
  });

  it("renders audit-event rows merged from both core and amie sources", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(auditEventsFixture));
    renderTab(amieFailedFixture);
    // 1 core audit_events row + 2 amie_audit_log rows = 3 rows.
    await waitFor(() => {
      const rows = screen.getAllByRole("row");
      // 1 header row + 3 data rows
      expect(rows.length).toBe(4);
    });
    expect(screen.getByText("CREATE_PERSON")).toBeInTheDocument();
    expect(screen.getByText("CREATE_PROJECT")).toBeInTheDocument();
    expect(screen.getByText("ComanageProvisioningFailed")).toBeInTheDocument();
  });
});
