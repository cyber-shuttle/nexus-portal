# Backend contract — memberships and overrides

Live in core (`internal/server/server.go:115-128`). Phase 3 wires the mutation
endpoints.

## POST /compute-allocation-memberships

```json
{
  "compute_allocation_id": "alloc-001",
  "user_id": "user-042",
  "start_time": "2026-05-22T00:00:00Z",
  "end_time": "2026-12-31T23:59:59Z",
  "membership_status": "ACTIVE"
}
```

Server-assigned: `id`.

Response — full `ComputeAllocationMembership`.

## PUT /compute-allocation-memberships/{id}

Patch any subset of `start_time`, `end_time`, `membership_status`. Backend
model has no `role` field — role surfacing is portal-derived (PI = the
project's `project_pi_id`; everyone else is "User"). If/when the backend grows
a role enum, lift the portal derivation into a server field.

## PUT /compute-allocation-memberships/{id}/status

Status-only convenience.

```json
{ "membership_status": "INACTIVE" }
```

## DELETE /compute-allocation-memberships/{id}

204 on success.

## POST | PUT | DELETE /compute-allocation-membership-resource-overrides[/{id}]

Resource override CRUD.

```json
{
  "compute_allocation_membership_id": "alloc-001-mem-3",
  "compute_allocation_resource_id": "alloc-001-res-1",
  "override_resource_amount": 8,
  "override_resource_time": 14400
}
```
