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
