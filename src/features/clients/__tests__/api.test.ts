import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientSchema,
  createClientPayloadSchema,
  deactivateClientPayloadSchema,
  rotateClientSecretPayloadSchema,
} from "../schemas";
import { createClient, deactivateClient, listClients } from "../api";
import { ApiError } from "@shared/api/client";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

function mockResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

const validClient = {
  id: "client-001",
  name: "Pipeline",
  allocation_id: "alloc-001",
  allocation_name: "BIO-1",
  owner_user_id: "pi@nexus.local",
  client_id: "nexus-alloc-001-1",
  client_secret_last4: "1234",
  issued_at: "2026-04-01T00:00:00.000Z",
  status: "active" as const,
};

describe("clientSchema", () => {
  it("accepts a valid row", () => {
    expect(clientSchema.safeParse(validClient).success).toBe(true);
  });
  it("rejects an invalid status", () => {
    expect(clientSchema.safeParse({ ...validClient, status: "expired" }).success).toBe(false);
  });
});

describe("createClientPayloadSchema", () => {
  it("requires name 2+ chars", () => {
    expect(
      createClientPayloadSchema.safeParse({
        name: "x",
        allocation_id: "alloc-001",
        owner_user_id: "pi@nexus.local",
      }).success,
    ).toBe(false);
  });
  it("accepts a complete payload", () => {
    expect(
      createClientPayloadSchema.safeParse({
        name: "CI pipeline",
        allocation_id: "alloc-001",
        owner_user_id: "pi@nexus.local",
      }).success,
    ).toBe(true);
  });
});

describe("rotateClientSecretPayloadSchema", () => {
  it("requires rotated_by", () => {
    expect(rotateClientSecretPayloadSchema.safeParse({}).success).toBe(false);
  });
});

describe("deactivateClientPayloadSchema", () => {
  it("requires reason 3+", () => {
    expect(
      deactivateClientPayloadSchema.safeParse({
        deactivated_by: "admin",
        reason: "x",
      }).success,
    ).toBe(false);
  });
  it("accepts a valid payload", () => {
    expect(
      deactivateClientPayloadSchema.safeParse({
        deactivated_by: "admin",
        reason: "Key suspected leaked",
      }).success,
    ).toBe(true);
  });
});

describe("listClients fetcher", () => {
  it("filters by status and allocation", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { clients: [validClient], total: 1, limit: 0, offset: 0 }),
    );
    const result = await listClients({
      status: "active",
      allocationId: "alloc-001",
    });
    expect(result.total).toBe(1);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("status=active");
    expect(calledUrl).toContain("allocationId=alloc-001");
  });
});

describe("createClient", () => {
  it("rejects with ApiError on 422", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(422, { error: "unknown_allocation" }));
    await expect(
      createClient({
        name: "Pipeline",
        allocation_id: "alloc-bogus",
        owner_user_id: "pi@nexus.local",
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

describe("deactivateClient", () => {
  it("posts the deactivate body", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { ...validClient, status: "deactivated" }),
    );
    const out = await deactivateClient("client-001", {
      deactivated_by: "admin@nexus.local",
      reason: "Key leaked",
    });
    expect(out.status).toBe("deactivated");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });
});
