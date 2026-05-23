import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

function mockResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function newClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
}

const enabledCluster = {
  id: "cluster-001",
  name: "Bridges-2",
  status: "ENABLED" as const,
  type: "Compute",
  location: "PSC",
  allocation_count: 47,
  user_count: 213,
};

const disabledCluster = {
  id: "cluster-003",
  name: "Nexus-Legacy",
  status: "DISABLED" as const,
  type: "Compute",
  location: "Legacy",
  allocation_count: 5,
  user_count: 12,
};

describe("useEnabledClusters", () => {
  it("requests /compute-clusters with status=ENABLED", async () => {
    // Lazy-import after the global fetch stub is in place so the module
    // captures the stubbed reference.
    const { useEnabledClusters } = await import("../queries");
    fetchMock.mockResolvedValueOnce(mockResponse(200, [enabledCluster]));

    const client = newClient();
    const { result } = renderHook(() => useEnabledClusters(), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.status).toBe("ENABLED");

    const url = fetchMock.mock.calls[0]?.[0] as string;
    expect(url).toContain("status=ENABLED");
  });

  it("never surfaces DISABLED rows when the backend honors the filter", async () => {
    // The hook is a thin wrapper around the GET — we rely on the backend's
    // status filter. If the backend ever returns DISABLED rows under this
    // filter that's a backend regression, not a UI bug.
    const { useEnabledClusters } = await import("../queries");
    fetchMock.mockResolvedValueOnce(mockResponse(200, [enabledCluster]));

    const client = newClient();
    const { result } = renderHook(() => useEnabledClusters(), {
      wrapper: wrapperWith(client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.some((c) => c.status === "DISABLED")).toBe(false);
  });
});

describe("useClusters", () => {
  it("returns the full list (both ENABLED and DISABLED) when no filter is set", async () => {
    const { useClusters } = await import("../queries");
    fetchMock.mockResolvedValueOnce(mockResponse(200, [enabledCluster, disabledCluster]));

    const client = newClient();
    const { result } = renderHook(() => useClusters({}), { wrapper: wrapperWith(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((c) => c.status).sort()).toEqual(["DISABLED", "ENABLED"]);
  });
});

describe("useUpdateClusterStatus", () => {
  it("PATCHes the cluster then invalidates every cluster query variant", async () => {
    const { useClusters, useEnabledClusters, useUpdateClusterStatus } = await import(
      "../queries"
    );

    const client = newClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    // GET (all), GET (enabled-only), PATCH, and the two refetches the mutation
    // triggers via the invalidation cascade.
    fetchMock.mockResolvedValueOnce(mockResponse(200, [enabledCluster, disabledCluster]));
    fetchMock.mockResolvedValueOnce(mockResponse(200, [enabledCluster]));
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { ...enabledCluster, status: "DISABLED" }),
    );
    fetchMock.mockResolvedValueOnce(mockResponse(200, [disabledCluster]));
    fetchMock.mockResolvedValueOnce(mockResponse(200, []));

    const { result } = renderHook(
      () => ({
        all: useClusters({}),
        enabled: useEnabledClusters(),
        update: useUpdateClusterStatus(),
      }),
      { wrapper: wrapperWith(client) },
    );

    await waitFor(() => expect(result.current.all.isSuccess).toBe(true));
    await waitFor(() => expect(result.current.enabled.isSuccess).toBe(true));

    await result.current.update.mutateAsync({ id: "cluster-001", status: "DISABLED" });

    // The mutation's onSuccess invalidates the full `clusters` tree, which
    // would otherwise leave a stale "all" + "enabled-only" cache after a flip.
    const invalidations = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidations.some((k) => Array.isArray(k) && k[0] === "clusters")).toBe(true);

    // PATCH body matched the mutation arg.
    const patchCall = fetchMock.mock.calls.find((c) => {
      const init = c[1] as RequestInit | undefined;
      return init?.method === "PATCH";
    });
    expect(patchCall).toBeTruthy();
    expect(JSON.parse(patchCall?.[1]?.body as string)).toEqual({ status: "DISABLED" });
  });
});
