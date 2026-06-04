import { recordTraceId } from "@shared/api/last-trace-id";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  recordTraceId(null);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  recordTraceId(null);
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

describe("useLastTraceId", () => {
  it("reads a value recorded before mount", async () => {
    recordTraceId("a3b1c92d3f4e5a6b7c8d9e0f12345678");
    const { useLastTraceId } = await import("../queries");
    const { result } = renderHook(() => useLastTraceId());
    await waitFor(() => {
      expect(result.current).toBe("a3b1c92d3f4e5a6b7c8d9e0f12345678");
    });
  });

  it("reacts to a value recorded after mount", async () => {
    const { useLastTraceId } = await import("../queries");
    const { result } = renderHook(() => useLastTraceId());
    expect(result.current).toBeNull();
    act(() => {
      recordTraceId("b4c2da3e405f6b7c8d9e0f1234567890");
    });
    await waitFor(() => {
      expect(result.current).toBe("b4c2da3e405f6b7c8d9e0f1234567890");
    });
  });
});

describe("useRetryTrace", () => {
  it("invalidates every traces query on 202 so lists and stats refetch", async () => {
    const { useRetryTrace, traceKeys } = await import("../queries");
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));

    const client = newClient();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRetryTrace(), {
      wrapper: wrapperWith(client),
    });

    await act(async () => {
      await result.current.mutateAsync("a3b1c92d3f4e5a6b7c8d9e0f12345678");
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: traceKeys.all });
  });
});
