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
