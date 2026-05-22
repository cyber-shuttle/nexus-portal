import { ApiError } from "@shared/api/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listCertificates, revokeCertificate } from "../api";
import { certificateSchema, revokeCertificatePayloadSchema } from "../schemas";
import { deriveCertificateStatus } from "../types";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

function mockResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

const validCert = {
  serial_number: 1024,
  client_id: "nexus-c1",
  allocation_id: "alloc-001",
  allocation_name: "BIO-1",
  key_id: "k-1",
  principal: "alice",
  username: "alice@nexus.local",
  public_key_fingerprint: "SHA256:abc",
  ca_fingerprint: "SHA256:ca",
  valid_after: 0,
  valid_before: 9_999_999_999,
  issued_at: 0,
  granted_extensions: ["permit-pty"],
  force_command: null,
  revoked: false,
};

describe("certificateSchema", () => {
  it("accepts a complete certificate row", () => {
    expect(certificateSchema.safeParse(validCert).success).toBe(true);
  });

  it("rejects when revoked flag is wrong type", () => {
    expect(certificateSchema.safeParse({ ...validCert, revoked: "yes" }).success).toBe(false);
  });
});

describe("revokeCertificatePayloadSchema", () => {
  it("requires at least 3-char reason", () => {
    expect(revokeCertificatePayloadSchema.safeParse({ reason: "no" }).success).toBe(false);
  });
  it("accepts a valid reason", () => {
    expect(revokeCertificatePayloadSchema.safeParse({ reason: "User requested" }).success).toBe(
      true,
    );
  });
});

describe("deriveCertificateStatus", () => {
  it("returns revoked when the row is revoked", () => {
    expect(deriveCertificateStatus({ ...validCert, revoked: true }, 100)).toBe("revoked");
  });
  it("returns expired when valid_before has passed", () => {
    expect(deriveCertificateStatus({ ...validCert, valid_before: 50 }, 100)).toBe("expired");
  });
  it("returns active when still valid", () => {
    expect(deriveCertificateStatus({ ...validCert, valid_before: 200 }, 100)).toBe("active");
  });
});

describe("listCertificates fetcher", () => {
  it("forwards filters as query params", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { certificates: [validCert], total: 1, limit: 10, offset: 0 }),
    );
    const result = await listCertificates({
      status: "active",
      username: "alice",
      limit: 10,
      offset: 0,
    });
    expect(result.total).toBe(1);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("status=active");
    expect(calledUrl).toContain("username=alice");
    expect(calledUrl).toContain("limit=10");
  });

  it("omits status when set to all", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { certificates: [], total: 0, limit: 0, offset: 0 }),
    );
    await listCertificates({ status: "all" });
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain("status=");
  });
});

describe("revokeCertificate", () => {
  it("posts the reason to the revoke endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { ...validCert, revoked: true, revoked_at: 999, revocation_reason: "x" }),
    );
    const result = await revokeCertificate(1024, { reason: "Just because" });
    expect(result.revoked).toBe(true);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });

  it("throws ApiError on 409 already_revoked", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(409, { error: "already_revoked" }));
    await expect(revokeCertificate(1024, { reason: "Already revoked" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
