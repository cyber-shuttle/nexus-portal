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
  "membership_status": "ACTIVE",
  "portal_role": "user"
}
```

Server-assigned: `id`.

Response — full `ComputeAllocationMembership`.

`portal_role` is a portal-only field (see gap section). The backend ignores it.

## PUT /compute-allocation-memberships/{id}

Patch any subset of `start_time`, `end_time`, `membership_status`.

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

## Backend gaps

### 1. `role` column missing on `ComputeAllocationMembership`

The portal needs PI / Co-PI / Allocation Manager / User role tagging per
membership; the backend `ComputeAllocationMembership` model has none. Until the
column lands the portal:

- Surfaces a role selector in the Add Member drawer (default User).
- Sends the choice as `portal_role` on the POST body. Real backend strips it;
  MSW persists it in `seed.membershipRoles[membershipId]`.
- Derives the PI role for display from `Project.project_pi_id` (any other
  member defaults to User).

Required backend addition:

```go
type ComputeAllocationMembership struct {
    // …existing fields…
    Role string `json:"role" gorm:"type:varchar(32);not null;default:'user'"`
}
```

with a CHECK constraint (or enum table) restricting to
`pi | co_pi | allocation_manager | user`. Once that lands the portal drops the
`portal_role` field and reads `role` directly.

### 2. `/users?q=` autocomplete is portal-only

Phase 3 added `GET /users?q=&limit=` for the member-add autocomplete; backend
doesn't expose it yet. See `docs/backend-contracts/users.md`.
