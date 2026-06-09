# Backend contract — admin tracing

Status: **Phase 1 — MSW handlers implement this verbatim.** The custos backend
goal on `tracing-impl` shipped the endpoints below; once the deployment exposes
them under the portal proxy, `PORTAL_LIVE_ENDPOINTS` flips and the MSW worker
steps aside.

Source of truth: `airavata-custos/internal/server/admin_traces.go` (handlers)
and `airavata-custos/pkg/models/trace.go` (wire shapes). Spec addenda in
`docs/internal/portal/2026-06-03-tracing-admin-ui.md` §11.

## Resource shapes

### Trace
| Field | Type | Notes |
|---|---|---|
| `trace_id` | string | 32-char lowercase hex (Trace.MarshalJSON). |
| `root_name` | string | Root span name (e.g. `amie.process_event:request_account_create`). |
| `source` | enum | `amie \| http \| comanage \| slurm`. Widens as new connectors land (§11.6). |
| `status` | int | 0=OK, 1=Error, 2=Cancelled, 3=Orphaned (§11.7). |
| `started_at` | RFC3339 | |
| `ended_at` | RFC3339? | Omitted/null for orphaned traces (no end). |
| `span_count` | int | Total spans persisted for this trace. |
| `root_event` | unknown? | Original AMIE packet payload. NULL for non-AMIE roots and pre-capture rows (§11.1). |

### Span
| Field | Type | Notes |
|---|---|---|
| `span_id` | string | 16-char lowercase hex. |
| `parent_span_id` | string? | 16-char lowercase hex. Omitted (never null) when the row is a root. |
| `name` | string | |
| `kind` | int | 0=internal, 1=server, 2=client, 3=producer, 4=consumer. |
| `status` | int | Same codes as trace status. |
| `status_message` | string? | Free-form error/status text. |
| `start_time` | RFC3339 | |
| `end_time` | RFC3339? | Omitted/null while a span is in-flight or orphaned. |
| `attributes` | unknown? | NULL on synthetic retry roots and many internal spans (§11.1). |

Retry spans look like `name = "retry:<original_root_name>"` with
`attributes.retry.attempt` and `attributes.retry.of_span` set. `parent_span_id`
is the original root's span_id (not null) so the trace_id chain remains intact
(§11.2). The portal renders them as sibling subtrees in the waterfall.

## Endpoints

All routes are admin-only; the backend gates server-side and the portal
double-gates via CASL `ability.can('read', 'Trace')` and `'retry', 'Trace'`.

### GET `/admin/traces`
List traces matching the filter set.

Query params:
- `source` (repeatable or comma-separated) — restricts to listed sources.
- `status` (repeatable or comma-separated integers 0..3).
- `from`, `to` (RFC3339) — restrict by `started_at`.
- `q` — partial match on `trace_id` and `root_name`.
- `limit` (default 50, capped at 200 — silently clamped, §11.5).
- `offset` (capped at 1_000_000 — returns 400 if exceeded).

Response 200:
```json
{ "traces": [Trace, ...], "total": 123, "limit": 50, "offset": 0 }
```

### GET `/admin/traces/{traceId}`
Fetch the trace summary + its full span list.

Response 200:
```json
{ "trace": Trace, "spans": [Span, ...] }
```
Returns 400 on malformed trace_id (must be 32-char lowercase hex), 404 when no
trace exists.

### GET `/admin/traces/stats`
Stacked counts per status per day for the rolling window.

Query params:
- `window` (default `30d`, max `365d` — `Nd` shorthand or any Go-duration).

Response 200:
```json
{ "byDay": [ { "date": "2026-06-03", "status": 0, "count": 17 }, ... ] }
```

### POST `/admin/traces/{traceId}/retry`
Re-execute the original flow under the same trace_id. No request body. Spec
§11.3 gives the full status-code matrix.

| Status | When |
|---|---|
| 202 | Queued — toast `"Retry queued — trace will reappear with a new root span"`. |
| 400 | Malformed trace_id (the portal builds the URL, so this should never trigger). |
| 404 | Trace not found. |
| 409 | Source not registered for retry — surface "Retry not supported for traces from <source>." |
| 410 | Original target purged (e.g. AMIE packet deleted). |
| 422 | Source is `amie` but `root_event` is NULL — pre-capture trace, cannot retry. |
| 5xx | Backend error envelope. |

Error envelope on 4xx/5xx: `{ "error": "..." }` (matches the custos
`writeError` pattern).

### GET `/admin/audit-events?trace_id=...&span_id=...`
Lookup audit-row references for a trace (and optionally a specific span).

Response 200:
```json
{
  "audit_events": [ { "id", "event_type", "event_time", "entity_id", "details", "trace_id", "span_id" } ],
  "amie_audit_log": [ { "id", "packet_id", "event_id", "action", "entity_type", "entity_id", "summary", "created_at", "trace_id", "span_id" } ]
}
```
`trace_id` is 32-char hex, `span_id` is 16-char hex on every returned row.
`amie_audit_log.entity_id`, `summary`, and `event_id` may be null.

## Nullability rules

Per §11.1 the Zod schemas treat `root_event`, `attributes`, `ended_at`,
`end_time`, `status_message`, `entity_id`, `summary`, and `event_id` as
`.nullish()` — equally tolerant of `null` and omitted. `parent_span_id` is
`.optional()` only (the backend omits via len==0 check; it never emits literal
null).
