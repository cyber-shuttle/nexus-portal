"use client";

import { getLastTraceId, subscribeLastTraceId } from "@shared/api/last-trace-id";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import {
  type TraceListFilters,
  type TraceStatsParams,
  getAuditEventsForTrace,
  getTrace,
  getTraceStats,
  listTraces,
  retryTrace,
} from "./api";
import { useLastTraceContext } from "./components/LastTraceProvider";

const DEFAULT_STALE_TIME = 30_000;
const DEFAULT_GC_TIME = 5 * 60_000;

export const traceKeys = {
  all: ["traces"] as const,
  lists: () => [...traceKeys.all, "list"] as const,
  list: (filters: TraceListFilters) => [...traceKeys.lists(), filters] as const,
  details: () => [...traceKeys.all, "detail"] as const,
  detail: (id: string) => [...traceKeys.details(), id] as const,
  stats: (window: string) => [...traceKeys.all, "stats", window] as const,
  audit: (id: string, spanId?: string) => [...traceKeys.all, "audit", id, spanId ?? null] as const,
};

export function useTraces(filters: TraceListFilters = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: traceKeys.list(filters),
    queryFn: () => listTraces(filters),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus: false,
    enabled: options?.enabled ?? true,
  });
}

export function useTrace(id: string | undefined) {
  return useQuery({
    queryKey: id ? traceKeys.detail(id) : [...traceKeys.details(), "none"],
    queryFn: () => getTrace(id as string),
    enabled: Boolean(id),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useTraceStats(window = "30d") {
  const params: TraceStatsParams = { window };
  return useQuery({
    queryKey: traceKeys.stats(window),
    queryFn: () => getTraceStats(params),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useAuditEventsForTrace(id: string | undefined, spanId?: string) {
  return useQuery({
    queryKey: id ? traceKeys.audit(id, spanId) : [...traceKeys.all, "audit", "none"],
    queryFn: () => getAuditEventsForTrace(id as string, spanId),
    enabled: Boolean(id),
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_GC_TIME,
    refetchOnWindowFocus: false,
  });
}

export function useRetryTrace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => retryTrace(id),
    // List rows and stats buckets shift after a retry too; invalidating the
    // feature root (prefix-match) catches every cached tracing query.
    onSuccess: () => {
      client.invalidateQueries({ queryKey: traceKeys.all });
    },
  });
}

// Prefers LastTraceProvider's context value; falls back to a singleton
// subscription so consumers rendered outside the provider (or in unit tests)
// still observe updates.
export function useLastTraceId(): string | null {
  const fromContext = useLastTraceContext();
  const [traceId, setTraceId] = React.useState<string | null>(() => fromContext ?? null);
  React.useEffect(() => {
    if (fromContext !== undefined) return;
    setTraceId(getLastTraceId());
    return subscribeLastTraceId(setTraceId);
  }, [fromContext]);
  return fromContext ?? traceId;
}
