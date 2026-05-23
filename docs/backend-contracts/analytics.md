# Backend contract — analytics

Status: **Phases A1–A4 — MSW handlers serve every endpoint listed here.**
The `/analytics` route resolves per-persona variants (researcher / PI /
admin) and consumes a mix of:

- **Existing backend endpoints** the portal already calls in other features
  (extended in some cases with new query params).
- **Portal-only enumerations** added in Phase A3 so analytics can render
  site-wide views without the per-user search the rest of the portal uses.
- **MSW-only data sources** for things the backend doesn't yet expose
  (jobs, queue wait times, saved views) — these are the v1 backend ask.
- **Proposed endpoints** noted alongside the MSW heuristic the portal ships
  in their place. Real backend implementers can negotiate against this doc.

Every endpoint here is Zod-validated on the portal client; mismatched
payloads surface as `ZodError` in the dev console.

---

## 1. Researcher + PI feature endpoints (`/jobs`, `/queues/wait-time`)

These are **MSW-only in v1.** The backend has no job records or queue
wait-time data exposed yet; both feed the researcher recent-jobs table /
wait-time bars and the PI scoped variants of the same.

### Resource shape — Job

| Field | Type | Notes |
|---|---|---|
| `job_id` | string | Cluster-supplied identifier; opaque to the portal. |
| `user_id` | string | Submitting user. |
| `allocation_id` | string | Charged compute allocation. |
| `resource_id` | string | `ComputeAllocationResource.id` the job ran on. |
| `started_at` | RFC3339 | Job start timestamp. |
| `su_used` | number | Total SUs charged for the job. |
| `wait_seconds` | int | Queue wait between submission and start. |
| `status` | enum | `COMPLETED \| RUNNING \| FAILED \| CANCELLED`. |

### Resource shape — QueueWaitTime

| Field | Type | Notes |
|---|---|---|
| `queue` | string | Cluster queue name (e.g. `normal`, `gpu`, `largemem`). In MSW we key on `resource_id` because the seed has no queue field on jobs; the real backend keys on queue. |
| `avg_wait_seconds` | int | Mean wait across the window. |
| `p50` | int | Median wait, seconds. |
| `p90` | int | 90th-percentile wait, seconds. |
| `sample_size` | int | Number of jobs the bucket aggregates. |

### Endpoint table

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/jobs` | query: `user_id?`, `project_id?`, `from?`, `to?`, `limit?` | `Job[]` | Sort: `started_at` desc, then `job_id` desc as a tiebreaker. Researcher passes its own `user_id`; PI scopes by `project_id` (MSW resolves to the union of the project's allocation ids). `limit` applies post-filter; researcher page passes `limit=25`. |
| GET | `/queues/wait-time` | query: `from?`, `to?`, `project_id?`, `group_by?` | `QueueWaitTime[]` | MSW ignores `from`/`to` (seed is static); contract accepts them so the real backend can bucket without portal changes. `project_id` filters jobs to that project's allocations and recomputes avg/p50/p90 from those jobs only. |

### Status codes

- `200` on success. Empty windows return `[]`, never `404`.
- `400 { error: "invalid_request", issues }` on bad query params.
- `404 { error: "not_found" }` on a known-bad id (e.g. unknown user when
  the real backend enforces it).

### Auth model

- `/jobs`: bearer-token authenticated. Backend must enforce that `user_id`
  equals the caller unless the caller has admin or PI scope for the
  relevant project.
- `/queues/wait-time`: open to any authenticated user. Wait data is not
  user-private; queue config + machine counts are admin-only and live on
  separate endpoints when they land.

### Known approximations + scope notes

- **`limit=25` is the researcher table cap.** For larger windows the real
  backend should expose pagination (`?limit&offset`); the portal client
  passes `limit=25` only.
- **`group_by` is reserved for v2.** The portal does not pass `group_by`
  today; the contract accepts it so a future "wait by cluster" cut doesn't
  need a new endpoint.
- **Same-millisecond ties** on the real cluster: stable sort by `job_id`
  desc as the tiebreaker.

---

## 2. Admin enumerations (`/admin/projects-full`, `/admin/allocations-full`)

Portal-only enumerations added in Phase A3 so the admin analytics page can
render the full project × resource compliance matrix without fanning out
through a per-user search. Live alongside the existing summary endpoints
(`/admin/allocations` returns `{id,name,status}`; `-full` returns the full
row including `initial_su_amount`, `start_time`, `end_time`, etc.).

### Endpoint table

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/admin/projects-full` | — | `Project[]` | Full site-wide project enumeration. The portal filters by `status === "ACTIVE"` client-side for the KPI count. |
| GET | `/admin/allocations-full` | query: `status?` | `ComputeAllocation[]` | Full allocation rows (vs the summary triple `/admin/allocations` returns). `status` filter is server-side; the portal does not currently pass it. |

### Status codes

- `200` with the full enumeration (or empty array on a filter that excludes everything).
- `403` when the caller doesn't have admin scope.

### Auth model

- Admin scope required. The portal gates these queries with
  `ability.can('manage', 'Allocation')` at the route container; the backend
  must duplicate the enforcement.

### Known approximations + scope notes

- **No pagination.** Sites with >2000 allocations may need
  `?limit&offset` or cursor-based paging on the backend; the portal
  currently fetches everything in one shot.
- **Heavy admin-page payload.** Documented for the admin page's site-wide
  view; non-admin pages must not call these endpoints.

---

## 3. Admin per-allocation usage fan-out (existing) — and proposed site-total

The admin analytics page composes its KPI strip + cluster utilization chart
from `GET /compute-allocations/{id}/usages?from&to` fanned out across every
allocation returned by `/admin/allocations-full`. This is **N calls** —
fine for a few hundred allocations, painful when the site grows.

### Proposed (backend ask) — `GET /admin/compute-allocation-usages/site-total`

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/admin/compute-allocation-usages/site-total` | query: `from`, `to`, `group_by?=resource\|project\|day` | `{ total_used_su, by_day?: Array<{date, used_su}>, by_resource?: Array<{resource_id, used_su}>, by_project?: Array<{project_id, used_su}> }` | Site-wide rollup so the admin KPI strip + stacked-area card can render in one round trip. `group_by` is multi-value when comma-separated. |

**Status:** **NOT MSW-mocked yet.** The admin container today fans out
through the existing per-allocation endpoint; switching to this endpoint is
a transparent swap when the backend ships it.

### Status codes (proposed)

- `200` on success. Empty window returns the same shape with `total_used_su: 0` and empty arrays.
- `400 invalid_request` when `from > to`.
- `403` when the caller is not admin.

### Auth model (proposed)

- Admin-only. Backend must enforce; the portal route container also gates
  via CASL `manage Allocation`.

---

## 4. Per-allocation forecast — client-side today, proposed backend endpoint

`forecast()` in `src/shared/api/aggregator.ts` projects exhaust via a
rolling-7d burn slope over the per-allocation usage stream. This is the
spec-§5.2 contract; it is **deterministic and shared by every analytics
container** so different surfaces don't drift.

### Method documented as the wire contract

- Window: 7 days, ending at `asOf` (the active range end).
- Slope: `totalUsedInWindow / 7` SUs per day.
- Days remaining: `max(0, allocation.initial_su_amount - totalUsedAll) / slope`.
- Returns `{ exhaustDate: null, daysRemaining: null, method: "insufficient-data" }`
  when fewer than 7 distinct days of usage exist in the window, or when
  slope is 0.

### Proposed (backend ask) — `GET /compute-allocation-usages/{id}/forecast`

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/compute-allocation-usages/{id}/forecast` | query: `asOf?` (RFC3339, defaults to now) | `{ exhaust_date: RFC3339\|null, days_remaining: number\|null, method: "rolling-7d" \| "insufficient-data" }` | Server-side equivalent of the client `forecast()` helper. Identical method semantics so swapping doesn't change rendered numbers. |

**Status:** **NOT MSW-mocked yet.** The portal computes locally and the
contract above documents the interim shape. When the backend ships this,
the analytics containers swap the local call for a query without
re-tooling.

### Status codes (proposed)

- `200` on success.
- `404 not_found` for unknown allocation id.
- `403` when the caller can't read the allocation.

### Auth model (proposed)

- Same as `/compute-allocations/{id}/usages` — allocation owner, project
  PI, or admin.

---

## 5. Proposed — `GET /admin/resource-mappings` (per-resource budgets)

The admin compliance matrix today splits each project's total allocated
capacity evenly across the resources that project has any usage on. This
is a heuristic — the backend tracks `ComputeAllocationResourceMapping`
(allocation ↔ resource × resource_amount × resource_time) but does not
expose per-resource SU budgets. Two paths to a proper fix:

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/admin/resource-mappings` | query: `allocation_id?`, `resource_id?` | `Array<{ id, compute_allocation_id, compute_allocation_resource_id, allocated_su_amount, resource_amount, resource_time }>` | Exposes the existing mapping table with an added `allocated_su_amount` column so the matrix has an exact per-cell budget. |
| GET | `/admin/resource-budgets` | query: `from`, `to`, `project_id?`, `resource_id?` | `Array<{ project_id, resource_id, allocated_su, used_su }>` | Pre-rolled per-(project, resource) budget + usage for a window. Saves the matrix from N fan-out and from the even-split approximation. |

**Status:** **NOT MSW-mocked yet.** The matrix carries an "Approximate
per-resource allocation" caption + per-cell tooltip while the heuristic is
in effect (A3 gate F3). The same heuristic also drives per-resource rows
in the admin at-risk table (A6 / A4 F6) — when the budget endpoint lands,
both surfaces switch off the heuristic.

### Status codes (proposed)

- `200 []` on a filter that returns nothing.
- `403` when the caller is not admin.

### Auth model (proposed)

- Admin-only.

---

## 6. Saved Views (`/analytics/views`) — MSW-backed in v1

Status: **MSW-backed in A4.** Personal-only in v1 (no team-shared views).
Stored under `seed.savedViews` keyed by `(user_id, persona)`.

### Resource shape — SavedView

| Field | Type | Notes |
|---|---|---|
| `id` | string | Server-assigned. |
| `user_id` | string | Owner — the only one who can read / update / delete. |
| `name` | string | 1–80 chars. Unique per `(user, persona)`. |
| `persona` | enum | `researcher` \| `pi` \| `admin`. |
| `range` | object | `{ from: ISO, to: ISO, preset }` — captured from URL state at save time. |
| `group_by` | string[] | Multi-slot URL `?gb=` value as parsed list. |
| `filters` | object | Reserved for v2 — currently `{}`. |
| `is_default` | bool | At most one default per `(user, persona)`. |
| `created_at` | RFC3339 | Server-assigned. |
| `updated_at` | RFC3339 | Server-updates on PUT. |

### Endpoint table

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/api/v1/analytics/views` | query: `persona` | `SavedView[]` | Returns the caller's own views for the persona, sorted by `created_at` desc. |
| POST | `/api/v1/analytics/views` | body: `{ name, persona, range, group_by, filters?, is_default? }` | `SavedView` (201) | Caps at 5 per `(user, persona)` (returns `409 limit_reached`). Validates name uniqueness (returns `409 name_conflict`). When `is_default=true`, clears the default flag on the user's other views in the same persona. |
| PUT | `/api/v1/analytics/views/:id` | body: `{ name?, is_default? }` | `SavedView` | Owner-only. `403` for non-owner, `404` for unknown id. Body must include at least one mutable field. |
| DELETE | `/api/v1/analytics/views/:id` | — | `204` | Owner-only. `403` for non-owner, `404` for unknown id. |

### Status codes (full table)

| Code | Body | Trigger |
|---|---|---|
| `200` / `201` / `204` | as above | success |
| `400` | `{ error: "invalid_request", issues }` | Zod validation failure on body |
| `403` | `{ error: "forbidden" }` | PUT / DELETE on a view the caller doesn't own |
| `404` | `{ error: "not_found" }` | unknown id |
| `409` | `{ error: "limit_reached" }` | POST when the caller already has 5 views in that persona |
| `409` | `{ error: "name_conflict" }` | POST / PUT when name collides with another of the caller's views in the same persona |

### Auth model

- MSW identifies the caller via the `x-nexus-user` header or `?user=`
  query fallback (same convention as `/me/*`; documented in `auth.md`).
  The real backend will use the bearer token.
- Personal-only in v1. Team-shared / project-scoped views are a v2
  follow-up; the schema's `filters` slot reserves the surface.

### Known approximations + v1 caveats

- **Default-on-load behaviour.** The portal applies the single
  `is_default` view on a fresh navigation when none of `preset`, `from`,
  `to`, `gb` are present in the URL. Auto-apply runs once per page mount;
  subsequent URL state changes take precedence within the session.
- **Cap = 5 per `(user, persona)`.** UX choice, not a backend constraint —
  can be lifted when the chip strip gains an overflow menu (post-A6).
- **`range` snapshot is fixed at save time.** A view saved with
  `preset: "7d"` carries the literal `from/to` window at save time, not
  "the last 7 days from now". An "update view to current URL state"
  affordance is a v2 follow-up; the portal currently re-applies the
  snapshotted window verbatim.
- **Chip "pressed" state is derived from the URL.** The portal compares
  each saved view's snapshot to the current URL state and only the
  matching chip renders `aria-pressed="true"`. The moment the user edits
  the range or a group-by chip after applying, the press goes away — there
  is no longer a saved view applied, just a manual edit (A6 polish).
- **Cross-persona apply is not safe.** Each persona owns its own slot
  positions in `group_by`; a researcher view's slot 1 means something
  different in admin. A future version field on the payload + a
  slot-name mapping would unlock cross-persona apply when a user has both
  personas.

---

## 7. Site-wide aggregation (backend ask, not in v1)

The PI page composes "member contribution" via N
`GET /compute-allocations/{id}/users/{userId}/usages/total` calls per
membership. Acceptable for ≤ a few hundred members per project. A future
`GET /compute-allocations/{id}/members/usage-rollup?from&to` would collapse
the fan-out into one round trip; tracked as a v2+ backend ticket because
no in-flight customer has hit the cap.

---

## Open questions

1. **Aggregation horizon for `/queues/wait-time`.** Completed jobs only,
   or include `RUNNING`? Default assumption: completed only, because
   in-flight waits don't have a `start_at` yet.
2. **Mapping resources to queues.** Several queues feed multiple compute
   allocation resources; do we surface a join in the contract or keep the
   two cuts independent? v1 keeps them independent; admin A3 may add a
   `queue_resources` join endpoint if the matrix proves useful.
3. **Method versioning on the forecast endpoint.** When the backend ships
   `/forecast`, do we version the `method` field so the portal can detect
   a behaviour change? The current `"rolling-7d"` string is the natural
   first version key.
