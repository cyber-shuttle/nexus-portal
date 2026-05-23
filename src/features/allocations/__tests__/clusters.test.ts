import { afterEach, describe, expect, it, vi } from "vitest";
import { listClusters, updateClusterStatus } from "../api";
import { clusterSchema, updateClusterStatusPayloadSchema } from "../schemas";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

function mockResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

const validCluster = {
  id: "cluster-001",
  name: "Bridges-2",
  status: "ENABLED" as const,
  type: "Compute",
  location: "PSC",
  allocation_count: 47,
  user_count: 213,
};

describe("clusterSchema", () => {
  it("accepts a valid ENABLED row", () => {
    expect(clusterSchema.safeParse(validCluster).success).toBe(true);
  });

  it("accepts a DISABLED row with no in-flight jobs", () => {
    expect(clusterSchema.safeParse({ ...validCluster, status: "DISABLED" }).success).toBe(true);
  });

  it("rejects an unknown status (guards against silent drift)", () => {
    expect(clusterSchema.safeParse({ ...validCluster, status: "MAINTENANCE" }).success).toBe(false);
  });

  it("rejects a negative allocation_count", () => {
    expect(clusterSchema.safeParse({ ...validCluster, allocation_count: -1 }).success).toBe(false);
  });
});

describe("updateClusterStatusPayloadSchema", () => {
  it("requires status to be ENABLED or DISABLED", () => {
    expect(updateClusterStatusPayloadSchema.safeParse({ status: "ENABLED" }).success).toBe(true);
    expect(updateClusterStatusPayloadSchema.safeParse({ status: "DISABLED" }).success).toBe(true);
    expect(updateClusterStatusPayloadSchema.safeParse({ status: "OTHER" }).success).toBe(false);
  });
});

describe("listClusters fetcher", () => {
  it("omits the status param when not provided", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, [validCluster]));
    await listClusters();
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/compute-clusters");
    expect(calledUrl).not.toContain("status=");
  });

  it("forwards ?status=ENABLED for the enabled-only filter", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, [validCluster]));
    const out = await listClusters({ status: "ENABLED" });
    expect(out).toHaveLength(1);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("status=ENABLED");
  });

  it("Zod-rejects rows with an unexpected status from the backend", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, [{ ...validCluster, status: "WHATEVER" }]));
    await expect(listClusters()).rejects.toThrow();
  });
});

describe("updateClusterStatus fetcher", () => {
  it("PATCHes /compute-clusters/{id} with the status body", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { ...validCluster, status: "DISABLED" }));
    const out = await updateClusterStatus("cluster-001", "DISABLED");
    expect(out.status).toBe("DISABLED");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("PATCH");
    expect(typeof init?.body).toBe("string");
    expect(JSON.parse(init?.body as string)).toEqual({ status: "DISABLED" });
  });

  it("URL-encodes the cluster id (defensive against ids with slashes)", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, validCluster));
    await updateClusterStatus("cluster/odd", "ENABLED");
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/compute-clusters/cluster%2Fodd");
  });
});
