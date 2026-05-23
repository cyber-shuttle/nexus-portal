# Backend contract — analytics

Status: **Phase A1 — MSW handlers serve these.** The /analytics researcher
page consumes them today; PI (A2) and admin (A3) will widen the contract
without changing the existing fields.

## Resource shapes

### Job
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

### QueueWaitTime
| Field | Type | Notes |
|---|---|---|
| `queue` | string | Cluster queue name (e.g. `normal`, `gpu`, `largemem`). |
| `avg_wait_seconds` | int | Mean wait across the window. |
| `p50` | int | Median wait, seconds. |
| `p90` | int | 90th-percentile wait, seconds. |
| `sample_size` | int | Number of jobs the bucket aggregates. |

## Endpoint table

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/jobs` | query: `user_id`, `from`, `to`, `limit` | `Job[]` | Sort: `started_at` desc. Researcher page passes its own `user_id`; PI/admin will widen with `allocation_id` and `project_id` filters in A2/A3. |
| GET | `/queues/wait-time` | query: `from`, `to`, `group_by=queue` | `QueueWaitTime[]` | A1 ignores `from`/`to` (MSW serves a static rollup); contract accepts them so the real backend can bucket without portal changes. |

## Validation + status codes

- Both responses are Zod-validated by the portal client.
- Errors are HTTP 4xx with `{ error: "invalid_request" | "not_found" }`.
- Empty windows return `[]` (not 404).

## Auth model

- `/jobs`: caller is whoever the bearer token represents. Backend must
  enforce that `user_id` matches the caller unless the caller has the
  admin or PI scope for the relevant project.
- `/queues/wait-time`: open to any authenticated user. Wait data is not
  user-private; we cap admin-only fields (queue config, machine counts) to
  separate endpoints when they land.

## Scope notes

- **A1 (this phase) only uses these for the researcher page.** PI and
  admin pages will extend the contract:
  - PI A2 needs `/jobs` filtered by `allocation_id` and `project_id`.
  - Admin A3 needs site-wide wait-time stats plus failure-rate cuts.
- **Gap acknowledged:** the portal recently-jobs table caps at 25. For
  larger windows the real backend should expose pagination
  (`?limit&offset`) — A1 client passes `limit=25` only.

## Open questions

1. **Aggregation horizon.** Does `/queues/wait-time` aggregate over
   completed jobs only, or include `RUNNING`? Default assumption: completed
   only, because in-flight waits don't have a `start_at` yet.
2. **Mapping resources to queues.** Several queues feed multiple
   compute_allocation_resources; do we surface a join in the contract or
   keep the two cuts independent? A1 ships them independently; A3 admin
   page may add a `queue_resources` join endpoint if the matrix is useful.
3. **Granularity of `started_at` ordering.** Same-millisecond ties on the
   real cluster: stable sort by job_id desc as the tiebreaker.

## Known approximations (backend tickets)

### Per-(project, resource) allocated SUs — admin compliance matrix

**Where:** `AdminAnalyticsContainer.tsx` → `allocatedByProjectResource`.

**What today:** the portal splits a project's total allocated capacity
evenly across the resources that project has any usage on. This is a
heuristic — the backend exposes `resourceMappings` (allocation ↔ resource
× resource_amount) but no per-allocation per-resource SU budget.

**Surfaced UX:** the admin ComplianceMatrix shows an "Approximate
per-resource allocation" caption and a per-cell tooltip "Approximate;
based on even split across project's resources." when the heuristic is in
effect (A3 carry-over F3).

**Proper fix (backend ticket):** expose one of —
- A direct `allocated_su_amount` column on `ComputeAllocationResource` (or
  per-mapping), set at allocation-creation time from the per-resource
  budgets in the source system (AMIE, NAIRR, etc.).
- A site-wide `GET /admin/resource-budgets?from&to` endpoint returning
  `{ project_id, resource_id, allocated_su, used_su }` rows, so the portal
  can render the matrix without N fan-out and without the even-split
  approximation.

Until that lands the portal must keep the "Approximate" caption visible.

## Saved Views (Phase A4 — MSW-backed)

Status: **MSW-backed in A4.** Personal-only in v1 (no team-shared
views). Stored under `seed.savedViews` keyed by `user_id + persona`.

### Resource shape — SavedView

| Field | Type | Notes |
|---|---|---|
| `id` | string | Server-assigned. |
| `user_id` | string | Owner — the only one who can read / update / delete. |
| `name` | string | 1–80 chars. Unique per (user, persona). |
| `persona` | enum | `researcher` \| `pi` \| `admin`. |
| `range` | object | `{ from: ISO, to: ISO, preset }` — captured from URL state. |
| `group_by` | string[] | Multi-slot URL `?gb=` value as parsed list. |
| `filters` | object | Reserved for v2 — currently `{}`. |
| `is_default` | bool | At most one default per (user, persona). |
| `created_at` | RFC3339 | Server-assigned. |
| `updated_at` | RFC3339 | Server-updates on PUT. |

### Endpoint table

| Verb | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/analytics/views` | query: `persona` | `SavedView[]` | Returns the caller's own views for the persona, sorted by created_at desc. |
| POST | `/analytics/views` | body: `{ name, persona, range, group_by, filters?, is_default? }` | `SavedView` (201) | Caps at 5 per user per persona (returns 409 `{ error: "limit_reached" }` when over). Validates name uniqueness (returns 409 `{ error: "name_conflict" }`). When `is_default=true`, clears the default flag on the user's other views in the same persona. |
| PUT | `/analytics/views/:id` | body: `{ name?, is_default? }` | `SavedView` | Owner-only. Returns 403 for non-owner, 404 for unknown id. Body must include at least one mutable field. |
| DELETE | `/analytics/views/:id` | — | 204 | Owner-only. Returns 403 for non-owner, 404 for unknown id. |

### Auth model

- Identifies the caller via the same `x-nexus-user` header / `?user=`
  query fallback as the `/me/*` handlers (MSW dev convention; the real
  backend will use the bearer token). Documented in `auth.md`.
- Personal-only in v1: no `shared_with_team`, no project-scoped views.
  Team-shared views are a v2 follow-up.

### v1 caveats

- **Default-on-load behaviour:** the portal applies a single `is_default`
  view on a fresh navigation when no analytics-state URL params are present
  (`preset`, `from`, `to`, `gb` all absent). The auto-apply runs once per
  page mount; subsequent changes to URL state take precedence within the
  session.
- **Cap = 5 per (user, persona).** UX choice, not a backend constraint —
  can be lifted when the chip strip gains an overflow menu (A6+).
- **`range` snapshot is fixed at save time.** A view saved with
  `preset: "7d"` carries the literal `from/to` window at save time, not
  "the last 7 days from now". An "update view to current URL state"
  affordance is a v2 follow-up; the portal currently re-applies the
  snapshotted window verbatim.
