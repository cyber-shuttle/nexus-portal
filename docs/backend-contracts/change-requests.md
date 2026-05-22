# Backend contract — change requests

Live in core (`internal/server/server.go:102-113`). Phase 3 wires the mutation
endpoints from the portal.

## POST /compute-allocation-change-requests

Submit a credit-extension or status-change request.

Request body (snake_case, matches `pkg/models/allocation.go:
ComputeAllocationChangeRequest`):

```json
{
  "compute_allocation_id": "alloc-001",
  "requested_su_amount": 12000,
  "requested_status": "ACTIVE",
  "reason": "Need additional SUs to complete the BayesPrism run.",
  "requester_id": "pi@nexus.local"
}
```

Server-assigned: `id`, `change_status` (defaults `PENDING`), `timestamp`.

Response — full `ComputeAllocationChangeRequest`.

## PUT /compute-allocation-change-requests/{id}

Approver action. Portal sends a partial patch:

```json
{
  "change_status": "APPROVED",
  "approver_id": "admin@nexus.local"
}
```

Allowed `change_status` transitions: `PENDING → APPROVED | REJECTED`.

Response — updated `ComputeAllocationChangeRequest`. The portal expects an
event row to be appended server-side when status flips (audit trail).

## DELETE /compute-allocation-change-requests/{id}

Admin-only. No body. 204 on success.

## GET /compute-allocations/{id}/change-requests, GET /users/{id}/change-requests, GET /compute-allocation-change-requests/{id}/events

Already live; see server.go for handler signatures.

## Backend gaps

These are encoded portal-side until the backend grows real columns. The portal
will transparently flip to first-class fields the moment they appear in
`pkg/models/allocation.go`.

### 1. `requested_change_type` column missing

`ComputeAllocationChangeRequest` only carries `requested_su_amount`,
`requested_status`, and `reason`. The portal exposes three change types in the
UI (`INCREASE_CREDITS`, `EXTEND_END_DATE`, `OTHER`) and encodes the choice as a
`reason`-prefix:

| UI choice | `reason` prefix | Numeric encoding |
|---|---|---|
| INCREASE_CREDITS | none | `requested_su_amount = current + delta` |
| EXTEND_END_DATE | `[EXTEND_END_DATE → YYYY-MM-DD] ` | `requested_su_amount` unchanged |
| OTHER | `[OTHER] ` | `requested_su_amount` unchanged |

Workaround scales for visual display but blocks server-side filtering and
indexing. Land a real `requested_change_type` enum next time the schema
changes; portal will drop the prefix dance on the same release.

### 2. `ComputeAllocationChangeRequestEvent.actor_id` missing

The event row in `pkg/models/allocation.go:83-89` only stores
`event_type / description / timestamp`. Until a real `actor_id` lands, the
portal embeds the actor inside `description` (`Change request approved by
admin@nexus.local`). MSW handlers do the same so dev mirrors production.

Land an indexed `actor_id` (FK to `users.id`) so the audit timeline can be
filtered by actor without parsing strings.
