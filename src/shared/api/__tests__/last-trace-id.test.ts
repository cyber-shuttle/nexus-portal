import { apiFetch } from "@shared/api/client";
import { getLastTraceId, recordTraceId } from "@shared/api/last-trace-id";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  recordTraceId(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  recordTraceId(null);
});

function jsonResponse(body: unknown, traceId?: string): Response {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (traceId) headers["x-trace-id"] = traceId;
  return new Response(JSON.stringify(body), { status: 200, headers });
}

describe("apiFetch X-Trace-Id capture", () => {
  it("records the X-Trace-Id header into the singleton store", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true }, "a3b1c92d3f4e5a6b7c8d9e0f12345678"),
    );
    await apiFetch("/example");
    expect(getLastTraceId()).toBe("a3b1c92d3f4e5a6b7c8d9e0f12345678");
  });

  it("leaves the singleton untouched when the header is absent", async () => {
    recordTraceId("previous-id");
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await apiFetch("/example");
    expect(getLastTraceId()).toBe("previous-id");
  });
});
