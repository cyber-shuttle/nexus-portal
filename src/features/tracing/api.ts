import { ApiError, apiFetch } from "@shared/api/client";
import {
  auditEventsResponseSchema,
  retryErrorEnvelopeSchema,
  traceDetailResponseSchema,
  traceListResponseSchema,
  traceStatsResponseSchema,
} from "./schemas";
import type {
  AuditEventsResponse,
  RetryErrorEnvelope,
  TraceDetailResponse,
  TraceListResponse,
  TraceStatsResponse,
} from "./types";

export type TraceListFilters = {
  source?: string[];
  status?: number[];
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export type TraceStatsParams = {
  window?: string;
};

// Tracing-feature-local error type so Phase 5's retry modal can read the
// parsed envelope without re-validating. Public ApiError stays untyped.
export class RetryApiError extends ApiError {
  constructor(
    status: number,
    path: string,
    rawBody: unknown,
    public readonly body: RetryErrorEnvelope,
  ) {
    super(status, path, rawBody, body.error);
    this.name = "RetryApiError";
  }
}

function qs(filters: TraceListFilters): string {
  const search = new URLSearchParams();
  // Sort the multi-valued filters so identical filter sets in different
  // input order produce the same URL — keeps TanStack cache keys stable.
  if (filters.source?.length) {
    for (const s of [...filters.source].sort()) search.append("source", s);
  }
  if (filters.status?.length) {
    for (const s of [...filters.status].sort((a, b) => a - b)) {
      search.append("status", String(s));
    }
  }
  if (filters.from) search.set("from", filters.from);
  if (filters.to) search.set("to", filters.to);
  if (filters.q) search.set("q", filters.q);
  if (typeof filters.limit === "number") search.set("limit", String(filters.limit));
  if (typeof filters.offset === "number") search.set("offset", String(filters.offset));
  const str = search.toString();
  return str ? `?${str}` : "";
}

export async function listTraces(filters: TraceListFilters = {}): Promise<TraceListResponse> {
  const raw = await apiFetch(`/admin/traces${qs(filters)}`);
  return traceListResponseSchema.parse(raw);
}

export async function getTrace(traceId: string): Promise<TraceDetailResponse> {
  const raw = await apiFetch(`/admin/traces/${encodeURIComponent(traceId)}`);
  return traceDetailResponseSchema.parse(raw);
}

export async function getTraceStats(
  params: TraceStatsParams = { window: "30d" },
): Promise<TraceStatsResponse> {
  const search = new URLSearchParams();
  if (params.window) search.set("window", params.window);
  const str = search.toString();
  const raw = await apiFetch(`/admin/traces/stats${str ? `?${str}` : ""}`);
  return traceStatsResponseSchema.parse(raw);
}

// 202 Accepted with no body on success. 4xx/5xx is rethrown as RetryApiError
// with the parsed { error } envelope; falls back to the raw ApiError if the
// body doesn't match (e.g. proxy-injected HTML 500).
export async function retryTrace(traceId: string): Promise<void> {
  try {
    await apiFetch(`/admin/traces/${encodeURIComponent(traceId)}/retry`, { method: "POST" });
  } catch (err) {
    if (err instanceof ApiError) {
      const parsed = retryErrorEnvelopeSchema.safeParse(err.body);
      if (parsed.success) {
        throw new RetryApiError(err.status, err.path, err.body, parsed.data);
      }
    }
    throw err;
  }
}

export async function getAuditEventsForTrace(
  traceId: string,
  spanId?: string,
): Promise<AuditEventsResponse> {
  const search = new URLSearchParams();
  search.set("trace_id", traceId);
  if (spanId) search.set("span_id", spanId);
  const raw = await apiFetch(`/admin/audit-events?${search.toString()}`);
  return auditEventsResponseSchema.parse(raw);
}
