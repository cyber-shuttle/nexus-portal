# Backend contract — compute clusters

Spec §5.3 / §8 B4–B6 introduce a `status` column on `compute_clusters` plus a
list filter and a status-flip endpoint. Today the portal talks to MSW
(`src/mocks/handlers/clusters.ts`) and the seed carries `status` per row; the
backend ships the migration + endpoints in the same sprint per spec §8
sequencing.

## Schema migration

```sql
ALTER TABLE compute_clusters
  ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ENABLED';
```

`status` is one of `ENABLED` or `DISABLED`. The default keeps every existing
cluster live post-migration; admins flip via the PATCH endpoint below.

## GET /compute-clusters

Lists every cluster the caller can see (every authenticated persona — clusters
are read-public per CASL `read Cluster`).

Query params:

- `status` — optional. `ENABLED` or `DISABLED`. Omitting it returns every row.

Response (`application/json`) — array of:

```json
{
  "id": "cluster-001",
  "name": "Bridges-2",
  "status": "ENABLED",
  "type": "Compute",
  "location": "PSC",
  "allocation_count": 47,
  "user_count": 213,
  "inflight_jobs": 12
}
```

`allocation_count` / `user_count` reflect **every** allocation / user on the
cluster regardless of status, so a freshly disabled cluster still shows its
existing footprint in the admin Clusters table. `inflight_jobs` is optional —
omit when the backend can't compute it cheaply.

## PATCH /compute-clusters/{id}

Flips the cluster status. Admin-only (CASL `manage Cluster`).

Request body (`application/json`):

```json
{ "status": "DISABLED" }
```

Returns the updated cluster row (same shape as the GET above).

## Selector semantics — disable is a hint, not a kill switch

Per spec §5.4 the cluster filter applies to **new** flows only:

- Existing allocations continue to render their cluster, even when DISABLED.
- In-flight jobs continue. Disable is not a drain command.
- New flows (proposal wizard, allocation creation, SSH cert issue) call
  `useEnabledClusters()` from `@features/allocations/queries` and never offer
  a DISABLED cluster in the picker.

This keeps disable reversible: re-enable returns the cluster to selectors
without disturbing anything in flight.

## Audit ask — separate backend ticket

Every status flip should append a `ComputeClusterStatusEvent` row to the
audit stream so admins can trace why a cluster went dark. Suggested shape:

```json
{
  "id": "evt-…",
  "cluster_id": "cluster-001",
  "from_status": "ENABLED",
  "to_status": "DISABLED",
  "actor_user_id": "admin@nexus.local",
  "reason": "optional free-text",
  "occurred_at": "2026-05-22T20:14:33Z"
}
```

The PATCH endpoint emits the event in the same transaction as the cluster
update. The portal will surface these in the audit feed once the schema +
endpoint land.
