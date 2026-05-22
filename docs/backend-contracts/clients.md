# Backend contract — clients

A **client** is a workload identity (CI pipeline, agent, batch driver) that
authenticates against an allocation with a `client_id` / `client_secret` pair.
The portal lets owners and PIs view, rotate, and deactivate these credentials.

Base path under the portal proxy: `/api/v1/clients/...` (routes to
`CORE_API_BASE_URL` — clients are first-class core entities, not a signer
extension). When the backend ships this resource, the proxy's
`backendFor` mapping needs no change.

## Resource shape

```json
{
  "id": "client-001",
  "name": "Genomics CI pipeline",
  "allocation_id": "alloc-001",
  "allocation_name": "BIO130000-alloc-1",
  "owner_user_id": "pi@nexus.local",
  "client_id": "nexus-alloc-001-7",
  "client_secret_last4": "4291",
  "issued_at": "2026-04-12T09:00:00.000Z",
  "last_rotated_at": "2026-05-01T12:00:00.000Z",
  "status": "active"
}
```

- `client_secret_last4` — only the last 4 characters are ever returned.
- On **create** the backend MUST return the full `client_secret` exactly once
  in the response body (`{ client, client_secret: "…" }`). The portal can
  surface this in a one-time-reveal toast.
- `status` ∈ `{"active","deactivated"}`. Deactivation is one-way; rotation
  doesn't change status.

## Endpoints

### GET /clients

Query parameters:

| Param         | Type   | Notes |
|---------------|--------|-------|
| `status`      | enum   | `active`, `deactivated`, `all` (default). |
| `allocationId`| string | Filter to clients owned by a single allocation. |
| `ownerUserId` | string | Filter to clients owned by a specific user. |
| `limit`       | int    | Standard paging. |
| `offset`      | int    | Standard paging. |

Response: `{ clients, total, limit, offset }`.

### GET /clients/{id}

Returns one client or 404.

### POST /clients

```json
{
  "name": "Genomics CI pipeline",
  "allocation_id": "alloc-001",
  "owner_user_id": "pi@nexus.local"
}
```

Validation:

- `name` 2–120 chars.
- `allocation_id` must reference an existing allocation; reject with
  `unknown_allocation` (422).
- `owner_user_id` must reference an existing user.

Response (201) MUST include the full `client_secret` once:

```json
{
  "id": "client-026",
  "name": "Genomics CI pipeline",
  "...": "rest of resource",
  "client_secret": "n3xus-shhh-very-secret-only-shown-once"
}
```

### POST /clients/{id}/rotate-secret

```json
{ "rotated_by": "admin@nexus.local" }
```

Invalidates the previous secret. Response includes the **new** full secret
(same shape as create). The portal MUST treat the response as one-time
material and surface a copy-to-clipboard affordance. Rotating a `deactivated`
client returns 409 with `client_deactivated`.

### POST /clients/{id}/deactivate

```json
{
  "deactivated_by": "admin@nexus.local",
  "reason": "Key suspected to have leaked via Slack export"
}
```

Validation:

- `reason` 3–500 chars.

Effect: flips `status` → `deactivated`. The signer service should reject any
new SSH-cert issuance request authenticated with this client.

## Authorization

- `read Client` — owner (`owner_user_id == session.user_id`), PI of the
  allocation (`allocation_id ∈ session.myPiAllocations`), or admin.
- `create Client` — owner (on their allocations), PI, admin.
- `manage Client` (rotate-secret, deactivate) — owner, PI of the allocation,
  admin. PI scope is a courtesy: PIs revoke a CI agent on their own
  allocation without paging the original creator.

## Open questions

1. Are clients allowed to span multiple allocations, or one-allocation-only?
   Portal assumes one-allocation-only; revisit if a backend epic demands
   shared-secret pipelines.
2. Should rotation history be exposed (timestamp + actor list) — for now the
   portal surfaces only the latest `last_rotated_at`.
3. Bulk-deactivate when an entire allocation is closed — Phase 7 admin tool.
