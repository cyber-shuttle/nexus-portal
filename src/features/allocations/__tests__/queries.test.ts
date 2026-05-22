import { ApiError } from "@shared/api/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getAllocation, getAllocationResources, getResourceRatesEffective } from "../api";

const allocationFixture = {
  id: "alloc-test",
  project_id: "project-x",
  name: "TestAlloc",
  status: "ACTIVE",
  compute_cluster_id: "cluster-001",
  initial_su_amount: 1000,
  start_time: "2026-01-01T00:00:00Z",
  end_time: "2026-12-31T00:00:00Z",
};

const resourceFixture = [
  {
    id: "res-1",
    name: "cpu-standard",
    resource_type: "cpu",
    resource_amount: 16,
  },
];

const rateFixture = {
  id: "rate-1",
  compute_allocation_resource_id: "res-1",
  rate: 0.5,
  start_time: "2026-01-01T00:00:00Z",
  end_time: "2026-12-31T00:00:00Z",
};

const originalFetch = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

beforeAll(() => {});

describe("allocations fetchers", () => {
  it("parses an allocation response", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(allocationFixture)) as never;
    const result = await getAllocation("alloc-test");
    expect(result.id).toBe("alloc-test");
    expect(result.status).toBe("ACTIVE");
  });

  it("parses a resources list response", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(resourceFixture)) as never;
    const result = await getAllocationResources("alloc-test");
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("cpu-standard");
  });

  it("parses an effective rate", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(rateFixture)) as never;
    const result = await getResourceRatesEffective("res-1");
    expect(result.rate).toBe(0.5);
  });

  it("throws ApiError on 500", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: "boom" }, 500)) as never;
    await expect(getAllocation("alloc-test")).rejects.toBeInstanceOf(ApiError);
  });

  it("handles 404 as ApiError, not a parse error", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: "not_found" }, 404)) as never;
    await expect(getAllocation("missing")).rejects.toBeInstanceOf(ApiError);
  });
});
