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
