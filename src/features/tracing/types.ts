// Wire shapes from custos pkg/models/trace.go + UI shapes for the rebuilt
// Trace view. Integer enums (status, kind) survive on the wire; tone-derived
// UI semantics live alongside them.

import type { z } from "zod";
import type {
  auditEventsResponseSchema,
  retryErrorEnvelopeSchema,
  spanSchema,
  traceDetailResponseSchema,
  traceListResponseSchema,
  traceSchema,
  traceStatsResponseSchema,
} from "./schemas";

export type Trace = z.infer<typeof traceSchema>;
export type Span = z.infer<typeof spanSchema>;
export type TraceSource = "amie" | "http" | "comanage" | "slurm" | "core" | (string & {});
export type TraceListResponse = z.infer<typeof traceListResponseSchema>;
export type TraceDetailResponse = z.infer<typeof traceDetailResponseSchema>;
export type TraceStatsResponse = z.infer<typeof traceStatsResponseSchema>;
export type AuditEventsResponse = z.infer<typeof auditEventsResponseSchema>;
export type RetryErrorEnvelope = z.infer<typeof retryErrorEnvelopeSchema>;

export const TRACE_SOURCES: ReadonlyArray<TraceSource> = [
  "amie",
  "http",
  "comanage",
  "slurm",
  "core",
];

export type RowTone = "ok" | "error" | "in-progress" | "orphaned" | "no-status";

// Wire span augmented with derived run-state flags. `running` = unfinished;
// `notRun` = skipped because a parent failed; `orphan` = parent_span_id
// doesn't resolve in this trace's span set.
export type UISpan = Span & {
  running?: boolean;
  notRun?: boolean;
  orphan?: boolean;
};

export type EntityRef = {
  kind: string;
  primaryId: string;
  attrs: Record<string, string>;
};
