import { z } from "zod";

// Known sources today (§11.6); widen-through any unknown so a new connector
// landing before the portal updates doesn't break parsing.
export const traceSourceSchema = z.enum(["amie", "http", "comanage", "slurm"]).or(z.string());

// Codes are int8 on the wire; don't cap so a future status/kind value still
// parses. UI lookups go through getTraceStatusInfo / getSpanKindLabel in types.ts.
const traceStatusCodeSchema = z.number().int().nonnegative();
const spanKindCodeSchema = z.number().int().nonnegative();

// trace_id is rendered as 32-char lowercase hex (see Trace.MarshalJSON).
const traceIdHexSchema = z
  .string()
  .regex(/^[0-9a-f]{32}$/, "trace_id must be 32-char lowercase hex");

// span_id is 16-char lowercase hex.
const spanIdHexSchema = z.string().regex(/^[0-9a-f]{16}$/, "span_id must be 16-char lowercase hex");

// Nullable JSON columns per §11.1: `root_event` and `attributes` may be null
// or omitted entirely under omitempty. Treat both the same way.
const nullableJsonSchema = z.unknown().nullish();

export const traceSchema = z.object({
  trace_id: traceIdHexSchema,
  root_name: z.string(),
  source: traceSourceSchema,
  status: traceStatusCodeSchema,
  started_at: z.string(),
  ended_at: z.string().nullish(),
  span_count: z.number().int().nonnegative(),
  root_event: nullableJsonSchema,
});

export const spanSchema = z.object({
  span_id: spanIdHexSchema,
  // Backend omits parent_span_id when len == 0; never emits literal null. Use
  // .optional() not .nullable().optional().
  parent_span_id: spanIdHexSchema.optional(),
  name: z.string(),
  kind: spanKindCodeSchema,
  status: traceStatusCodeSchema,
  status_message: z.string().nullish(),
  start_time: z.string(),
  end_time: z.string().nullish(),
  attributes: nullableJsonSchema,
});

export const traceListResponseSchema = z.object({
  traces: z.array(traceSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
});

export const traceDetailResponseSchema = z.object({
  trace: traceSchema,
  spans: z.array(spanSchema),
});

export const traceStatBucketSchema = z.object({
  date: z.string(),
  status: traceStatusCodeSchema,
  count: z.number().int().nonnegative(),
});

export const traceStatsResponseSchema = z.object({
  byDay: z.array(traceStatBucketSchema),
});

export const coreAuditEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  event_time: z.string(),
  entity_id: z.string(),
  details: z.string(),
  trace_id: traceIdHexSchema,
  span_id: spanIdHexSchema,
});

export const amieAuditLogSchema = z.object({
  id: z.number().int(),
  packet_id: z.string(),
  event_id: z.string().nullish(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.string().nullish(),
  summary: z.string().nullish(),
  created_at: z.string(),
  trace_id: traceIdHexSchema,
  span_id: spanIdHexSchema,
});

export const auditEventsResponseSchema = z.object({
  audit_events: z.array(coreAuditEventSchema),
  amie_audit_log: z.array(amieAuditLogSchema),
});

// Custos error envelope (matches writeError in internal/server). Used to type
// the body of 4xx/5xx responses thrown as ApiError.
export const retryErrorEnvelopeSchema = z.object({
  error: z.string(),
});
