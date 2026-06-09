import { tracesHandlers } from "@mocks/handlers/traces";
import { describe, expect, it } from "vitest";

// Invoke each handler resolver directly to assert the response shape and
// status-code matrix without booting setupServer + global fetch. The order in
// tracesHandlers matches the order they're declared in handlers/traces.ts.

type HandlerEntry = (typeof tracesHandlers)[number] & {
  resolver: (ctx: {
    request: Request;
    params: Record<string, string>;
    cookies: Record<string, string>;
  }) => Promise<Response> | Response;
};

const [
  listHandler,
  statsHandler,
  detailHandler,
  retryHandler,
  auditHandler,
] = tracesHandlers as unknown as [
  HandlerEntry,
  HandlerEntry,
  HandlerEntry,
  HandlerEntry,
  HandlerEntry,
];

const AMIE_FAILED_ID = "a3b1c92d3f4e5a6b7c8d9e0f12345678";
const HTTP_ID = "c5d3eb4f516a7b8c9d0e1f2345678901";
const ORPHANED_ID = "e7f50d617382b7c8d9e0f1234567abef";

async function call(
  handler: HandlerEntry,
  url: string,
  init: RequestInit & { params?: Record<string, string> } = {},
): Promise<Response> {
  const { params = {}, ...requestInit } = init;
  const result = await handler.resolver({
    request: new Request(url, requestInit),
    params,
    cookies: {},
  });
  if (!result) throw new Error("handler did not respond");
  return result;
}

describe("traces MSW handlers", () => {
  it("GET /admin/traces returns the list fixture", async () => {
    const res = await call(listHandler, "http://localhost/api/v1/admin/traces");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { traces: unknown[]; total: number };
    expect(body.traces.length).toBe(5);
    expect(body.total).toBe(5);
  });

  it("GET /admin/traces filters by source", async () => {
    const res = await call(
      listHandler,
      "http://localhost/api/v1/admin/traces?source=amie",
    );
    const body = (await res.json()) as { traces: { source: string }[] };
    expect(body.traces.every((t) => t.source === "amie")).toBe(true);
  });

  it("GET /admin/traces clamps limit at 200", async () => {
    const res = await call(
      listHandler,
      "http://localhost/api/v1/admin/traces?limit=5000",
    );
    const body = (await res.json()) as { limit: number };
    expect(body.limit).toBe(200);
  });

  it("GET /admin/traces rejects offset > 1_000_000", async () => {
    const res = await call(
      listHandler,
      "http://localhost/api/v1/admin/traces?offset=2000000",
    );
    expect(res.status).toBe(400);
  });

  it("GET /admin/traces/:id returns the detail fixture", async () => {
    const res = await call(
      detailHandler,
      `http://localhost/api/v1/admin/traces/${AMIE_FAILED_ID}`,
      { params: { traceId: AMIE_FAILED_ID } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { spans: unknown[] };
    expect(body.spans.length).toBeGreaterThan(0);
  });

  it("GET /admin/traces/:id rejects malformed trace ids", async () => {
    const res = await call(
      detailHandler,
      "http://localhost/api/v1/admin/traces/not-hex",
      { params: { traceId: "not-hex" } },
    );
    expect(res.status).toBe(400);
  });

  it("GET /admin/traces/stats returns the stats fixture", async () => {
    const res = await call(
      statsHandler,
      "http://localhost/api/v1/admin/traces/stats?window=30d",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { byDay: unknown[] };
    expect(body.byDay.length).toBeGreaterThan(0);
  });

  it("GET /admin/traces/stats rejects windows >365d", async () => {
    const res = await call(
      statsHandler,
      "http://localhost/api/v1/admin/traces/stats?window=400d",
    );
    expect(res.status).toBe(400);
  });

  it("POST retry returns 202 for the amie-failed fixture", async () => {
    const res = await call(
      retryHandler,
      `http://localhost/api/v1/admin/traces/${AMIE_FAILED_ID}/retry`,
      { method: "POST", params: { traceId: AMIE_FAILED_ID } },
    );
    expect(res.status).toBe(202);
  });

  it("POST retry returns 422 for the orphaned fixture", async () => {
    const res = await call(
      retryHandler,
      `http://localhost/api/v1/admin/traces/${ORPHANED_ID}/retry`,
      { method: "POST", params: { traceId: ORPHANED_ID } },
    );
    expect(res.status).toBe(422);
  });

  it("POST retry returns 409 for the http fixture", async () => {
    const res = await call(
      retryHandler,
      `http://localhost/api/v1/admin/traces/${HTTP_ID}/retry`,
      { method: "POST", params: { traceId: HTTP_ID } },
    );
    expect(res.status).toBe(409);
  });

  it("GET /admin/audit-events returns the linked fixture for the amie-failed trace", async () => {
    const res = await call(
      auditHandler,
      `http://localhost/api/v1/admin/audit-events?trace_id=${AMIE_FAILED_ID}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      audit_events: unknown[];
      amie_audit_log: unknown[];
    };
    expect(body.audit_events.length).toBeGreaterThan(0);
    expect(body.amie_audit_log.length).toBeGreaterThan(0);
  });

  it("GET /admin/audit-events returns empty arrays for unknown trace ids", async () => {
    const res = await call(
      auditHandler,
      "http://localhost/api/v1/admin/audit-events?trace_id=b4c2da3e405f6b7c8d9e0f1234567890",
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      audit_events: unknown[];
      amie_audit_log: unknown[];
    };
    expect(body.audit_events).toEqual([]);
    expect(body.amie_audit_log).toEqual([]);
  });
});
