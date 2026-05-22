# Backend contract — admin

Portal-only endpoints introduced in Phase 2 to back the admin home dashboard.
Implemented in MSW (`src/mocks/handlers/admin.ts`); the core has no equivalent
today. Phase 3+ should either land these in the core or replace them with
domain-side aggregations.

## GET /admin/stats

Site-wide rollup powering the admin home stat cards and the 30-day pace chart.

Request — no params.

Response (`application/json`):

```json
{
  "total_projects": 50,
  "active_allocations": 123,
  "total_su_allocated_quarter": 5439930,
  "total_su_charged_quarter": 1473104,
  "pending_proposals": 4,
  "amie_failed_24h": 1,
  "allocations_by_day": [
    { "date": "2026-04-23", "count": 2 }
  ]
}
```

`allocations_by_day` is a 30-row dense series (one row per day, zero-filled).

## GET /admin/change-requests

Admin pending queue (top 50 by submission time).

Query params:

- `status` — optional, defaults to `PENDING`. Multi via comma.
- `limit` — optional, default 50.

Response — array of `ComputeAllocationChangeRequest` rows as defined in
`pkg/models/allocation.go` (snake_case JSON).

## GET /admin/resources

Site-wide rollup of `ComputeAllocationResource` rows with aggregated
allocation / usage / rate counters. Powers the Phase 7 resources admin
page.

Query params:

- `cluster` — optional cluster id filter.
- `status` — optional, `ACTIVE` or `INACTIVE`. Derived from whether any
  parent allocation is `ACTIVE`.
- `q` — optional substring match against `name` and `resource_type`.

Response (`application/json`) — array of:

```json
{
  "id": "alloc-001-res-1",
  "name": "cpu-standard",
  "resource_type": "cpu",
  "cluster_id": "cluster-001",
  "cluster_name": "Nexus-A",
  "allocation_count": 3,
  "total_allocated_su": 240000,
  "total_used_su": 96000,
  "used_pct": 40.0,
  "rate_count": 2,
  "status": "ACTIVE"
}
```

The portal will eventually replace the client-side aggregation with
`GET /compute-allocation-resources/{id}/usages/total` (see
`usage.md`).

## GET /admin/resources/{id}/usage-trend

30-day daily usage series for one resource.

Response — array of `{ date: "YYYY-MM-DD", used_su: number }` (30 rows,
zero-filled).

## GET /admin/rates / POST /admin/rates / POST /admin/rates/{id}/deactivate

CRUD over `ComputeAllocationResourceRate` rows.

`GET /admin/rates` returns:

```json
{
  "id": "alloc-001-rate-1",
  "compute_allocation_resource_id": "alloc-001-res-1",
  "resource_name": "cpu-standard",
  "cluster_name": "Nexus-A",
  "rate": 1.250,
  "effective_from": "2026-01-01T00:00:00Z",
  "effective_to": "2026-12-31T23:59:59Z",
  "active": true
}
```

`POST /admin/rates` body:

```json
{
  "compute_allocation_resource_id": "alloc-001-res-1",
  "rate": 1.5,
  "effective_from": "2026-06-01T00:00:00Z",
  "effective_to": "2027-05-31T23:59:59Z"
}
```

`POST /admin/rates/{id}/deactivate` sets `effective_to = now` and
returns the updated row.

Non-overlapping windows are enforced on create. The MSW handler
treats `[effective_from, effective_to)` as half-open and rejects a
create whose window overlaps any existing rate for the same
`compute_allocation_resource_id` with:

```http
HTTP/1.1 409 Conflict
Content-Type: application/json

{
  "error": "rate_overlaps_existing",
  "existing_rate_id": "alloc-001-rate-1"
}
```

The portal surfaces this as a toast pointing at the conflicting row;
the form stays populated so the admin can adjust the window or
supersede the existing rate first. The real backend must enforce the
same constraint atomically (DB unique-exclude / `tstzrange` GiST).

## GET /admin/allocations

Lightweight allocation summaries for picker UIs (unmapped jobs link,
adjustments allocation field).

Query params:

- `q` — substring match against `id` and `name`.
- `status` — `ACTIVE` or `INACTIVE`.
- `limit` — default 50.

Response — array of `{ id, name, status }`.

## /admin/adjustments

Manual SU credits / debits / expirations against an allocation.

`GET /admin/adjustments?type=CREDIT&allocation_id=alloc-001` filters by
type and/or allocation. Response — array of:

```json
{
  "id": "adj-001",
  "allocation_id": "alloc-001",
  "allocation_name": "BIO130000-alloc-1",
  "type": "CREDIT",
  "amount": 5000,
  "reason": "Goodwill credit for outage 2026-03",
  "created_by": "admin@nexus.local",
  "created_at": "2026-05-22T10:00:00Z"
}
```

`POST /admin/adjustments` body:

```json
{
  "allocation_id": "alloc-001",
  "type": "CREDIT",
  "amount": 5000,
  "reason": "Goodwill credit for outage 2026-03"
}
```

The backend should append a row to `compute_allocation_diffs` with
`diff_type = ADJUSTMENT_*` so the change shows up in the allocation
audit log. The `transfer_id` discussion in `tools.md` applies — a
real diff schema with a nullable `adjustment_id` FK would be cleaner.

### Authorization

All endpoints in this file are admin-only — `manage all` or a
subject-specific `manage Resource/Rate/Adjustment` ability.

