# Backend contract — usage

The portal already wires the existing allocation-level usage rollups:

- `GET /compute-allocations/{id}/usages/total` — sum of `used_su_amount`
  across all `compute_allocation_usages` rows for that allocation.
- `GET /compute-allocations/{id}/users/{userId}/usages/total` — same,
  scoped to one membership user.

## Gap — per-resource aggregation

The allocation detail "Credits & Resources" tab needs **per-resource
totals**. The portal currently does this client-side: it fetches all
`ComputeAllocationUsage` rows for the allocation and sums by
`compute_allocation_resource_id`. For 30 days of hourly seed data this is
acceptable. For a real cluster — millions of rows per allocation — it is
not.

### Requested endpoint

```
GET /compute-allocation-resources/{id}/usages/total
  → { compute_allocation_resource_id, total_su_amount, total_raw_amount }
```

- Aggregates `used_su_amount` and `used_raw_amount` server-side across
  all usages whose `compute_allocation_resource_id` matches.
- Optional query params:
  - `from` (ISO ts) — only count usages with `last_updated >= from`.
  - `to` (ISO ts) — only count usages with `last_updated <= to`.
  - `user_id` — restrict to one user's contribution.

### Backwards-compat path

Until the endpoint ships, the portal degrades to the client-side sum.
MSW could expose this endpoint as a synthesizer at any time — the
contract is intentionally narrow so adding it later is a no-op for the
portal data layer (just swap `useResourceUsageTotal` to hit the new
endpoint).

### Why this matters

The admin "Resources management" page (`/admin/resources`) renders one
row per `ComputeAllocationResource` site-wide, and each row needs
`total used SUs`. With 200 allocations × 4 resources × 100 usages, the
portal would fetch ~80 k usage rows to render a single page. The
endpoint pushes that aggregation to where the data lives.
