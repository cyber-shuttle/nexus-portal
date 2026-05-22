import { afterEach, describe, expect, it, vi } from "vitest";
import { transferCredits } from "../api";
import { creditTransferPayloadSchema } from "../schemas";
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

const validPayload = {
  source_allocation_id: "alloc-001",
  destination_allocation_id: "alloc-007",
  compute_allocation_resource_id: "alloc-001-res-2",
  su_amount: 1000,
  transferred_by: "pi@nexus.local",
};

describe("creditTransferPayloadSchema", () => {
  it("accepts a valid payload", () => {
    expect(creditTransferPayloadSchema.safeParse(validPayload).success).toBe(true);
  });

  it("rejects a non-positive amount", () => {
    expect(
      creditTransferPayloadSchema.safeParse({ ...validPayload, su_amount: 0 }).success,
    ).toBe(false);
  });

  it("rejects missing transferred_by", () => {
    expect(
      creditTransferPayloadSchema.safeParse({ ...validPayload, transferred_by: "" }).success,
    ).toBe(false);
  });
});

describe("cross-allocation invariants", () => {
  function canTransfer(opts: {
    sourceStatus: string;
    destStatus: string;
    sourceRemaining: number;
    amount: number;
    sourceId: string;
    destId: string;
  }) {
    if (opts.sourceId === opts.destId) return "source_and_destination_must_differ";
    if (opts.sourceStatus !== "ACTIVE" || opts.destStatus !== "ACTIVE") {
      return "allocations_must_be_active";
    }
    if (opts.amount > opts.sourceRemaining) return "insufficient_balance";
    return null;
  }

  it("blocks transfer to the same allocation", () => {
    expect(
      canTransfer({
        sourceStatus: "ACTIVE",
        destStatus: "ACTIVE",
        sourceRemaining: 5000,
        amount: 1000,
        sourceId: "alloc-001",
        destId: "alloc-001",
      }),
    ).toBe("source_and_destination_must_differ");
  });

  it("blocks transfer when source is inactive", () => {
    expect(
      canTransfer({
        sourceStatus: "INACTIVE",
        destStatus: "ACTIVE",
        sourceRemaining: 5000,
        amount: 1000,
        sourceId: "alloc-001",
        destId: "alloc-007",
      }),
    ).toBe("allocations_must_be_active");
  });

  it("blocks transfer when destination is deleted", () => {
    expect(
      canTransfer({
        sourceStatus: "ACTIVE",
        destStatus: "DELETED",
        sourceRemaining: 5000,
        amount: 1000,
        sourceId: "alloc-001",
        destId: "alloc-007",
      }),
    ).toBe("allocations_must_be_active");
  });

  it("blocks transfer exceeding source remaining", () => {
    expect(
      canTransfer({
        sourceStatus: "ACTIVE",
        destStatus: "ACTIVE",
        sourceRemaining: 500,
        amount: 5000,
        sourceId: "alloc-001",
        destId: "alloc-007",
      }),
    ).toBe("insufficient_balance");
  });

  it("permits a clean transfer", () => {
    expect(
      canTransfer({
        sourceStatus: "ACTIVE",
        destStatus: "ACTIVE",
        sourceRemaining: 5000,
        amount: 1000,
        sourceId: "alloc-001",
        destId: "alloc-007",
      }),
    ).toBeNull();
  });
});

describe("transferCredits fetcher", () => {
  it("posts JSON and parses the response", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(201, {
        transfer_id: "xfer-1",
        source_allocation_id: "alloc-001",
        destination_allocation_id: "alloc-007",
        compute_allocation_resource_id: "alloc-001-res-2",
        su_amount: 1000,
        transferred_by: "pi@nexus.local",
        transferred_at: new Date().toISOString(),
        source_balance_after: 4000,
        destination_balance_after: 11000,
      }),
    );
    const result = await transferCredits(validPayload);
    expect(result.transfer_id).toBe("xfer-1");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("throws ApiError on 409", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(409, { error: "insufficient_balance" }),
    );
    await expect(transferCredits(validPayload)).rejects.toBeInstanceOf(ApiError);
  });
});
