# Backend contract — projects

Status: **TF0/TF1 portal MSW** ships every endpoint listed below. The portal
client Zod-validates both directions; mismatched payloads surface as
`ZodError` in the dev console. Backend implementers can negotiate against
this doc — every shape, query-param, and status code below is load-bearing.

See `airavata-custos/docs/portal/2026-05-22-nexus-portal-team-feedback-v1.md`
§8 (B1, B2, B3, B8) for the spec entry that produced this contract.

---

## 1. `GET /projects` — two-mode contract

A single route serves **both** the legacy autocomplete used by `/proposals`
and the paged list used by `/projects`. The `paged=1` query param is the
**load-bearing discriminator** between modes. Without it the response is a
bare array; with it the response is a `{items,total}` envelope. The real
backend MUST key on the same param so the route stays single-source.

### 1a. Autocomplete mode (no `paged` param)

| Verb | Path | Query | Response |
|---|---|---|---|
| GET | `/projects` | `q` (required, free-text), `limit?` (default 20, max 200) | `Project[]` (bare array, may be empty) |

Behaviour:
- Empty/missing `q` returns `[]` (no rows). The portal's `ProjectAutocomplete`
  primitive expects this — it does not want to enumerate the whole catalog.
- Match scope: substring against `id`, `originated_id`, or `title` (case-
  insensitive). Real backend may broaden to a search index.
- No filters beyond `q`. No total count.

### 1b. Paged list mode (`paged=1`)

| Verb | Path | Query | Response |
|---|---|---|---|
| GET | `/projects?paged=1` | `paged=1` (required, literal), `limit?` (default 20, max 200), `offset?` (default 0), `pi_id?`, `status?` (`ACTIVE\|INACTIVE\|DELETED`), `q?` | `{items: Project[], total: number}` |

Behaviour:
- `q` matches the same fields as autocomplete mode when present; absent =
  no text filter.
- `pi_id` filters by `projects.project_pi_id` equality.
- `status` filters by `projects.status` equality.
- `offset` + `limit` slice **after** filtering. `total` is the pre-slice
  filtered count so the client can render `Showing 1–20 of 47`.
- Order is implementation-defined for v1; the portal sorts client-side
  after fetch (default sort: "Used % desc, alpha tiebreak" — see TF1 spec).

### Resource shape — Project

| Field | Type | Notes |
|---|---|---|
| `id` | string | Internal stable id (uuid or short slug). |
| `originated_id` | string | External provenance id (e.g. ACCESS `BIO130000`). Surface-facing label on tables. |
| `title` | string | Free-text project title. |
| `origination` | string | Source system enum: `ACCESS \| LOCAL \| INTERNAL \| ...`. |
| `project_pi_id` | string | `users.id` of the PI. |
| `status` | enum | `ACTIVE \| INACTIVE \| DELETED`. |
| `created_time` | RFC3339 | UTC timestamp. |

### Status codes

- `200` — on success. Empty filters return `[]` (autocomplete) or
  `{items:[],total:0}` (paged), never `404`.
- `400 {error:"invalid_request", issues}` — on malformed query params.

---

## 2. `GET /users/{id}/projects` — member-derived

The "every project I belong to" view powering the persona-scoped
`/projects` list for researchers + members on PI lists.

Membership-derivation is the canonical definition: walk user → memberships
→ allocations → distinct project ids. Includes PI-owned projects because
PIs are seeded as members of their own allocations.

| Verb | Path | Response |
|---|---|---|
| GET | `/users/{id}/projects` | `Project[]` (bare array, may be empty) |

Status codes:

- `200` on success; `[]` on no memberships.
- `404 {error:"not_found"}` on unknown user id.

---

## 3. `GET /users/{id}/projects-as-pi` — PI-owned (legacy)

Pre-TF1 endpoint for "projects where I am the PI" rollup on the PI home
card. Distinct from `/users/{id}/projects` because that one also covers
member-only projects.

| Verb | Path | Response |
|---|---|---|
| GET | `/users/{id}/projects-as-pi` | `Project[]` |

Match: `projects.project_pi_id = {id}`.

---

## 4. `GET /projects/{id}/compute-allocations`

All compute allocations belonging to a project.

| Verb | Path | Response |
|---|---|---|
| GET | `/projects/{id}/compute-allocations` | `ComputeAllocation[]` |

Used by:
- Project detail Allocations tab (`/projects/[id]?tab=allocations`).
- The `/projects` list per-row rollup fan-out (each row spawns one of these
  calls to compute total SUs + member count; see fan-out cost below).

Status codes:

- `200` with `[]` on a project with no allocations; never `404`.
- `404 {error:"not_found"}` on unknown project id.

---

## 5. `GET /projects/{id}/usage-summary` — aggregated usage (MSW v1)

Mock-only in v1. Backed by the synthetic seed in `src/mocks/seed/index.ts`.
The portal client Zod-validates the response, so the real backend must
return the exact shape below.

| Verb | Path | Query | Response |
|---|---|---|---|
| GET | `/projects/{id}/usage-summary` | `from` (RFC3339), `to` (RFC3339) | `ProjectUsageSummary` |

### Shape — `ProjectUsageSummary`

```json
{
  "project_id": "project-001",
  "range": { "from": "2026-04-01T00:00:00.000Z", "to": "2026-05-01T00:00:00.000Z" },
  "total_allocated_su": 1000,
  "total_used_su": 250,
  "allocations": [
    { "allocation_id": "alloc-001", "allocation_name": "BIO-001", "allocated_su": 1000, "used_su": 250 }
  ],
  "by_resource": [
    { "resource_id": "alloc-001-res-1", "resource_name": "cpu-standard", "resource_type": "cpu", "used_su": 250, "used_pct": 100 }
  ],
  "by_member": [
    { "user_id": "u-1", "user_label": "Riya R", "used_su": 250 }
  ]
}
```

### Critical interpretation note — `by_resource[].used_pct`

**Today (MSW + v1 backend):** `used_pct = (used_su / total_used_su) * 100`.
That is, **share-of-project-total**. A resource that consumed 100 of the
project's 250 used SUs returns `used_pct: 40`.

**Why this interpretation:** resource-level allocated SUs are not modeled
in the v1 seed. Per-resource allocations live on
`compute_allocation_resources` but the cross-allocation per-resource sum
isn't readily computable without a more involved aggregation pass.

**Backend ask:** when resource-level allocated SUs exist (i.e. the backend
can compute `sum(allocated_su) per resource_type across the project's
allocations`), switch `used_pct` to **share-of-resource-allocated**
(`used_su / allocated_for_resource * 100`). This is the more useful
interpretation for the "is this resource saturated?" question the
`MostUsedResourceCallout` is trying to answer.

The portal client tolerates `used_pct` values above 100 (capped at 500 in
the Zod schema) because the share-of-resource interpretation can transiently
exceed 100 when accounting lags job completion.

### Status codes

- `200` on success; empty windows return zeroed totals + empty arrays.
- `400 {error:"invalid_request", issues}` on malformed `from`/`to`.
- `404 {error:"not_found"}` on unknown project id.

### Fan-out cost

The `/projects` list page calls `getProjectComputeAllocations` for every
row (top 50 cap per page) to compute rollup KPIs (total SUs, % used). For
admin with hundreds of projects this is the heavy cut — see Risks table in
the team-feedback spec §12. **TF1 caps at the 50-row page; future work:
expose a server-side rollup endpoint** (`GET /projects/rollups?ids=...` or
extend the list envelope with `summary` per row) so the portal doesn't
fan out per row.

---

## 6. `POST /projects` — create

| Verb | Path | Body | Response |
|---|---|---|---|
| POST | `/projects` | `{title, origination, project_pi_id}` | `Project` (full row, server-assigned `id` + `created_time`) |

### Status field — MSW hardcodes `ACTIVE`

The MSW handler today **hardcodes `status: "ACTIVE"` on every create.**
The body schema does not accept `status`.

**Backend ask:** accept an **optional** `status` field in the request body
defaulting to `ACTIVE` when absent. This keeps the v1 portal flow unchanged
while leaving room for a future DRAFT/SUBMITTED lifecycle without forcing a
new endpoint. The portal will not send `status` until the lifecycle
decision lands.

Body validation:

- `title` — required, 1–200 chars.
- `origination` — required, 1–64 chars, free-text enum (`ACCESS`,
  `LOCAL`, `INTERNAL`, ...).
- `project_pi_id` — required, must reference an existing user.

Status codes:

- `200` on success; returns the created row.
- `400 {error:"invalid_request", issues}` on body validation failure.
- `403 {error:"forbidden"}` when the caller lacks `create Project` (PI + admin only per CASL spec §5.5).

---

## 7. `PUT /projects/{id}/status` — lifecycle update

Narrow patch endpoint for status-only changes (the only field the v1
portal mutates after create).

| Verb | Path | Body | Response |
|---|---|---|---|
| PUT | `/projects/{id}/status` | `{status: "ACTIVE"\|"INACTIVE"\|"DELETED"}` | `Project` |

Status codes:

- `200` on success.
- `400 {error:"invalid_request", issues}` on bad enum.
- `403 {error:"forbidden"}` when the caller lacks `manage Project` on this row.
- `404 {error:"not_found"}` on unknown project id.

---

## 8. Auth model (all endpoints)

- Bearer-token authenticated.
- Read endpoints filter to rows the caller has `read Project` on
  (membership-derived per CASL spec §5.5).
- `POST` requires `create Project` (PI + admin).
- `PUT /status` requires `manage Project` (PI on own + admin).

---

## 9. Stability + drift signal

Every endpoint here is Zod-validated on the portal:

- Request bodies: `createProjectPayloadSchema`,
  `updateProjectStatusPayloadSchema` in `src/features/projects/schemas.ts`.
- Response payloads: `projectSchema`, `projectListEnvelopeSchema`,
  `projectUsageSummarySchema`, `computeAllocationSchema`.

If the real backend ships a divergent shape, the portal dev console
surfaces `ZodError` immediately and `pnpm test` flags the contract drift in
`src/features/projects/__tests__/api.test.ts`.
