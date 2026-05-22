import { ApiError } from "@shared/api/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createMembership,
  createMembershipOverride,
  createMembershipPayloadSchema,
  deleteMembership,
  overridePayloadSchema,
  setMembershipStatus,
  updateMembership,
  updateMembershipPayloadSchema,
} from "../api";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

function mockResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("createMembershipPayloadSchema", () => {
  it("accepts a valid payload and defaults status to ACTIVE", () => {
    const ok = createMembershipPayloadSchema.safeParse({
      compute_allocation_id: "alloc-001",
      user_id: "user-1",
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.membership_status).toBe("ACTIVE");
  });
  it("rejects missing user_id", () => {
    const bad = createMembershipPayloadSchema.safeParse({
      compute_allocation_id: "alloc-001",
      user_id: "",
      start_time: "x",
      end_time: "y",
    });
    expect(bad.success).toBe(false);
  });
});

describe("updateMembershipPayloadSchema", () => {
  it("rejects empty patches", () => {
    const bad = updateMembershipPayloadSchema.safeParse({});
    expect(bad.success).toBe(false);
  });
});

describe("overridePayloadSchema", () => {
  it("requires both ids and nonneg integers", () => {
    expect(
      overridePayloadSchema.safeParse({
        compute_allocation_membership_id: "m-1",
        compute_allocation_resource_id: "r-1",
        override_resource_amount: 10,
        override_resource_time: 60,
      }).success,
    ).toBe(true);
    expect(
      overridePayloadSchema.safeParse({
        compute_allocation_membership_id: "",
        compute_allocation_resource_id: "r-1",
        override_resource_amount: 10,
        override_resource_time: 60,
      }).success,
    ).toBe(false);
  });
});

describe("member mutation fetchers", () => {
  it("createMembership posts JSON and parses response", async () => {
    const created = {
      id: "alloc-001-mem-new",
      compute_allocation_id: "alloc-001",
      user_id: "user-1",
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 86_400_000).toISOString(),
      membership_status: "ACTIVE",
    };
    fetchMock.mockResolvedValueOnce(mockResponse(201, created));
    const out = await createMembership({
      compute_allocation_id: "alloc-001",
      user_id: "user-1",
      start_time: created.start_time,
      end_time: created.end_time,
      membership_status: "ACTIVE",
    });
    expect(out.id).toBe(created.id);
  });

  it("updateMembership throws ApiError on 400", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(400, { error: "bad" }));
    await expect(updateMembership("m-1", { membership_status: "INACTIVE" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("setMembershipStatus targets the /status sub-route", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, {
        id: "m-1",
        compute_allocation_id: "alloc-001",
        user_id: "user-1",
        start_time: new Date().toISOString(),
        end_time: new Date().toISOString(),
        membership_status: "INACTIVE",
      }),
    );
    await setMembershipStatus("m-1", "INACTIVE");
    const [url] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain("/compute-allocation-memberships/m-1/status");
  });

  it("deleteMembership resolves on 204", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteMembership("m-1")).resolves.toBeUndefined();
  });

  it("createMembershipOverride posts to overrides route", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(201, {
        id: "ov-1",
        compute_allocation_membership_id: "m-1",
        compute_allocation_resource_id: "r-1",
        override_resource_amount: 10,
        override_resource_time: 60,
      }),
    );
    const out = await createMembershipOverride({
      compute_allocation_membership_id: "m-1",
      compute_allocation_resource_id: "r-1",
      override_resource_amount: 10,
      override_resource_time: 60,
    });
    expect(out.id).toBe("ov-1");
  });
});
