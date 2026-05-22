# Backend contract — unmapped jobs

The portal exposes a queue of SLURM accounting records that the
ingestion pipeline could not match to a known allocation
(`compute_allocation_id`). Site admins triage by linking the job to the
right allocation or discarding with a reason.

Mocked in MSW (`src/mocks/handlers/admin.ts`); the core has no
equivalent today.

## Data shape

```json
{
  "id": "umj-001",
  "job_id": "slurm-2851234",
  "username": "riya.researcher",
  "cluster": "Nexus-A",
  "walltime_seconds": 7200,
  "su_charged": 240,
  "reason": "Unknown project code in job context",
  "raw_data": {
    "accounting_record": "JOBID=slurm-2851234 USER=… CLUSTER=…",
    "partition": "compute",
    "nodes": 2,
    "cpus_per_node": 32
  },
  "observed_at": "2026-05-20T12:34:00Z"
}
```

`raw_data` is opaque to the portal and surfaced verbatim in the
detail view so admins can see exactly what the SLURM ingest saw.

## Endpoints

### GET /admin/unmapped-jobs

Return the full queue. No pagination yet — assumption is the queue
stays small (< 200 rows). When it grows, add `?limit&offset` matching
the AMIE list envelope.

### POST /admin/unmapped-jobs/{id}/link

Body:

```json
{ "allocation_id": "alloc-001" }
```

Side effects:

1. Insert a `compute_allocation_usages` row attributed to the
   allocation, with `used_su_amount = su_charged` and
   `last_updated = observed_at`.
2. Delete the unmapped-jobs row.
3. Append a domain audit entry (CASL: `manage UnmappedJob` produced the
   action).

400 on schema failure; 404 on allocation not found.

### POST /admin/unmapped-jobs/{id}/discard

Body: `{ "reason": string (3..500) }`. Deletes the row and emits an
audit entry containing the reason. The job is *not* re-attributed to any
allocation.

## Authorization

Admin-only. The portal nav gates with
`ability: { action: "manage", subject: "UnmappedJob" }`.
