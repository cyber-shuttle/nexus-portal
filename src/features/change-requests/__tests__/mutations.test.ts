import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createChangeRequest,
  createChangeRequestPayloadSchema,
  deleteChangeRequest,
  updateChangeRequest,
  updateChangeRequestPayloadSchema,
} from "../api";
import { ApiError } from "@shared/api/client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

function mockResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("createChangeRequestPayloadSchema", () => {
  it("accepts a complete payload", () => {
    const ok = createChangeRequestPayloadSchema.safeParse({
      compute_allocation_id: "alloc-001",
      requested_su_amount: 12000,
      requested_status: "ACTIVE",
      reason: "more SUs",
      requester_id: "pi@nexus.local",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects missing requester_id", () => {
    const bad = createChangeRequestPayloadSchema.safeParse({
      compute_allocation_id: "alloc-001",
      requested_su_amount: 0,
      requested_status: "ACTIVE",
      reason: "x",
      requester_id: "",
    });
    expect(bad.success).toBe(false);
  });
});

describe("updateChangeRequestPayloadSchema", () => {
  it("rejects empty patches", () => {
    const bad = updateChangeRequestPayloadSchema.safeParse({});
    expect(bad.success).toBe(false);
  });
  it("accepts a single-field patch", () => {
    const ok = updateChangeRequestPayloadSchema.safeParse({ change_status: "APPROVED" });
    expect(ok.success).toBe(true);
  });
});

describe("change-request mutation fetchers", () => {
  it("createChangeRequest posts JSON and parses the response", async () => {
    const response = {
      id: "cr-1",
      compute_allocation_id: "alloc-001",
      requested_su_amount: 12000,
      requested_status: "ACTIVE",
      reason: "more SUs",
      change_status: "PENDING",
      requester_id: "pi@nexus.local",
      timestamp: new Date().toISOString(),
    };
    fetchMock.mockResolvedValueOnce(mockResponse(201, response));
    const created = await createChangeRequest({
      compute_allocation_id: "alloc-001",
      requested_su_amount: 12000,
      requested_status: "ACTIVE",
      reason: "more SUs",
      requester_id: "pi@nexus.local",
    });
    expect(created.id).toBe("cr-1");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect((init as RequestInit).method).toBe("POST");
  });

  it("updateChangeRequest throws ApiError on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(404, { error: "not_found" }));
    await expect(
      updateChangeRequest("cr-missing", { change_status: "APPROVED" }),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("deleteChangeRequest resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteChangeRequest("cr-1")).resolves.toBeUndefined();
  });
});
