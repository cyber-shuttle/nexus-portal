# DoD #13 — Cross-link affordances: backend-blocked descope

## Status

Deferred to a follow-up. The `ViewTraceLink` primitive ships in Phase 5;
its three documented consumers (AMIE packet drawer, allocation audit-log
tab, change-request event log) require backend changes before they can
land.

## Background

Spec §2 DoD #13 calls for "View trace →" affordances on three existing
portal surfaces, gated on `trace_id` being present on the relevant
audit/event row.

## Why deferred

The relevant Go schemas in the custos repo do not carry `trace_id` today:

- `PacketEvent` (`src/features/amie/types.ts`) — no `trace_id` field.
- `ComputeAllocationDiff`, `ComputeAllocationChangeRequest`,
  `ComputeAllocationChangeRequestEvent` (`src/shared/api/domain.ts`) —
  none carry `trace_id`.

The backend tracing spec
(`docs/architecture/2026-06-03-tracing-and-spans.md` in the custos repo)
does write `trace_id` to `AmieAuditLog` and `AuditEvent` rows — but those
are exposed via `/admin/audit-events?trace_id=...`, which is the LINKED
ENTITIES tab's data source (already wired in Phase 4). The cross-link
affordance on the three OTHER existing surfaces needs:

1. The corresponding wire-format types to carry `trace_id`.
2. A minimal targeted edit to the host feature to render
   `<ViewTraceLink traceId={row.trace_id} variant="icon" />`.

## Follow-up scope

Add `trace_id` to the three event schemas; thread through the existing
serialization; render the link. Estimated: 1 commit, 6 file changes
(3 schema + 3 component).

## What ships now

- `ViewTraceLink` primitive (unit-tested) — at
  `src/features/tracing/components/ViewTraceLink.tsx`.
- Two URL contracts working end-to-end:
  `/admin/traces/{id}?span=<spanId>` (deep-link) and
  `/admin/traces?trace=<id>` (overlay).
- End-to-end e2e at `tests/cross-link-view-trace.e2e.ts` covering both
  URL paths.
