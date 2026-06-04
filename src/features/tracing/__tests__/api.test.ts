import auditEventsFixture from "@features/tracing/__fixtures__/audit-events.fixture.json";
import statsFixture from "@features/tracing/__fixtures__/stats.fixture.json";
import amieFailedFixture from "@features/tracing/__fixtures__/trace.amie.failed.fixture.json";
import listFixture from "@features/tracing/__fixtures__/traces.list.fixture.json";
import {
  RetryApiError,
  getAuditEventsForTrace,
  getTrace,
  getTraceStats,
  listTraces,
  retryTrace,
} from "@features/tracing/api";
import { ApiError } from "@shared/api/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("tracing api", () => {
  it("listTraces serializes multi-value filters as repeated params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(listFixture));
    await listTraces({
      source: ["amie", "http"],
      status: [0, 1],
      from: "2026-05-01T00:00:00Z",
      to: "2026-06-01T00:00:00Z",
      q: "alice",
      limit: 50,
      offset: 0,
    });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toMatch(/\/admin\/traces\?/);
    expect(url).toContain("source=amie");
    expect(url).toContain("source=http");
    expect(url).toContain("status=0");
    expect(url).toContain("status=1");
    expect(url).toContain("q=alice");
    expect(url).toContain("limit=50");
  });

  it("listTraces sorts multi-value filters for cache-key stability", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(listFixture));
    await listTraces({ source: ["http", "amie"], status: [1, 0] });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url.indexOf("source=amie")).toBeLessThan(url.indexOf("source=http"));
    expect(url.indexOf("status=0")).toBeLessThan(url.indexOf("status=1"));
  });

  it("listTraces parses the list envelope through the zod schema", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(listFixture));
    const out = await listTraces();
    expect(out.traces).toHaveLength(5);
    expect(out.traces[0]?.source).toBe("amie");
  });

  it("listTraces rejects payloads that fail schema validation", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ traces: [{ trace_id: "not-hex" }], total: 0, limit: 0, offset: 0 }),
    );
    await expect(listTraces()).rejects.toBeInstanceOf(Error);
  });

  it("getTrace hits the detail route and parses the response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(amieFailedFixture));
    const detail = await getTrace(amieFailedFixture.trace.trace_id);
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain(`/api/v1/admin/traces/${amieFailedFixture.trace.trace_id}`);
    expect(detail.spans.length).toBeGreaterThan(0);
  });

  it("getTraceStats hits the stats route with the window param", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(statsFixture));
    await getTraceStats({ window: "30d" });
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/api/v1/admin/traces/stats");
    expect(url).toContain("window=30d");
  });

  it("retryTrace POSTs to the retry route and resolves on 202", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    await retryTrace("a3b1c92d3f4e5a6b7c8d9e0f12345678");
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
  });

  it("retryTrace throws a typed RetryApiError on 409", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "source not registered" }, { status: 409 }),
    );
    const err = await retryTrace("c5d3eb4f516a7b8c9d0e1f2345678901").catch((e) => e);
    expect(err).toBeInstanceOf(RetryApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as RetryApiError).status).toBe(409);
    expect((err as RetryApiError).body.error).toBe("source not registered");
  });

  it("retryTrace falls back to bare ApiError when the body is not the envelope", async () => {
    fetchMock.mockResolvedValueOnce(new Response("<html>500</html>", { status: 500 }));
    const err = await retryTrace("a3b1c92d3f4e5a6b7c8d9e0f12345678").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).not.toBeInstanceOf(RetryApiError);
  });

  it("getAuditEventsForTrace passes trace_id and span_id query params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(auditEventsFixture));
    await getAuditEventsForTrace("a3b1c92d3f4e5a6b7c8d9e0f12345678", "1000000000000006");
    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("/api/v1/admin/audit-events");
    expect(url).toContain("trace_id=a3b1c92d3f4e5a6b7c8d9e0f12345678");
    expect(url).toContain("span_id=1000000000000006");
  });
});
