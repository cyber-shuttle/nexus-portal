// Mirrors the Go wire shapes in custos pkg/models/trace.go and the handler
// responses in internal/server/admin_traces.go. Integer enums per spec §11.7;
// nullable JSON fields per §11.1. The source enum widens-through unknowns
// (§11.6) — new connectors flow through without a portal-side update.

import type { StatusBadgeVariant } from "@/shared/ui/StatusBadge";
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
export type TraceSource = "amie" | "http" | "comanage" | "slurm" | (string & {});
export type TraceListResponse = z.infer<typeof traceListResponseSchema>;
export type TraceDetailResponse = z.infer<typeof traceDetailResponseSchema>;
export type TraceStatsResponse = z.infer<typeof traceStatsResponseSchema>;
export type AuditEventsResponse = z.infer<typeof auditEventsResponseSchema>;
export type RetryErrorEnvelope = z.infer<typeof retryErrorEnvelopeSchema>;

export type TraceStatusInfo = {
  label: string;
  color: "success" | "danger" | "muted" | "warning";
};

export const TRACE_STATUS: Record<number, TraceStatusInfo> = {
  0: { label: "OK", color: "success" },
  1: { label: "Error", color: "danger" },
  2: { label: "Cancelled", color: "muted" },
  3: { label: "Orphaned", color: "warning" },
};

export const SPAN_KIND: Record<number, string> = {
  0: "internal",
  1: "server",
  2: "client",
  3: "producer",
  4: "consumer",
};

const UNKNOWN_TRACE_STATUS: TraceStatusInfo = { label: "Unknown", color: "muted" };

// Unknown status/kind codes are surfaced (not thrown away) — callers render
// "Unknown" rather than crash when the backend ships a new code ahead of the UI.
export function getTraceStatusInfo(status: number): TraceStatusInfo {
  return TRACE_STATUS[status] ?? UNKNOWN_TRACE_STATUS;
}

export function getSpanKindLabel(kind: number): string {
  return SPAN_KIND[kind] ?? "unknown";
}

export const TRACE_SOURCES: ReadonlyArray<TraceSource> = ["amie", "http", "comanage", "slurm"];

// Status integer → StatusBadge variant, shared by the table, drawer header,
// and overview MetaRow so the color story is identical across surfaces.
export const STATUS_TO_BADGE: Record<number, StatusBadgeVariant> = {
  0: "approved",
  1: "rejected",
  2: "inactive",
  3: "warning",
};

// Waterfall tree node — children are pre-sorted by start_time asc and retry
// roots are lifted to top-level siblings per spec §11.2. `collapsedCount`
// summarizes spans beyond the max-depth cutoff for a "+N collapsed" pill.
export type WaterfallNode = {
  span: Span;
  depth: number;
  children: WaterfallNode[];
  collapsedCount: number;
};

// --- Linked entities (Phase 4B) ---

export type LinkedEntityKind =
  | "amiePacket"
  | "comanagePerson"
  | "allocation"
  | "cluster"
  | "membership"
  | "override"
  | "user"
  | "httpRequest";

export type LinkedEntityField = {
  key: string;
  value: string;
  // PII fields render behind a `<details>` toggle on the Linked entities tab.
  pii?: boolean;
};

export type LinkedEntity = {
  kind: LinkedEntityKind;
  title: string;
  primaryId?: string;
  fields: LinkedEntityField[];
  // When set, the card renders a deep-link button. Absent ⇒ no route yet,
  // the card surfaces the IDs with a "Route not yet available" tooltip.
  href?: string;
  ctaLabel?: string;
};
