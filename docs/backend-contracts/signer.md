# Backend contract — signer

The signer service issues short-lived SSH certificates and tracks their
lifecycle. The portal consumes a small read-and-revoke surface; the actual
issuance flow happens out-of-band (a CLI / agent talks directly to the signer,
not through the portal proxy).

Base path under the portal proxy: `/api/v1/signer/...` (routes to
`SIGNER_API_BASE_URL` from `nexus-portal/.env`).

## Resource shape

```json
{
  "serial_number": 1024,
  "client_id": "nexus-alloc-001-7",
  "allocation_id": "alloc-001",
  "allocation_name": "BIO130000-alloc-1",
  "key_id": "nexus-key-1024",
  "principal": "riya.researcher",
  "username": "riya.researcher@nexus.local",
  "public_key_fingerprint": "SHA256:…",
  "ca_fingerprint": "SHA256:…",
  "valid_after": 1716370000,
  "valid_before": 1716391600,
  "issued_at": 1716370000,
  "source_ip": "10.0.42.7",
  "granted_extensions": ["permit-pty"],
  "force_command": null,
  "revoked": false
}
```

When `revoked` is `true`, also surface `revoked_at` (Unix seconds) and
`revocation_reason` (free-form string).

Time fields are Unix seconds — the signer's native format. The portal converts
to human-friendly date/time on render.

## Endpoints

### GET /signer/certificates

Query parameters (all optional):

| Param         | Type   | Notes |
|---------------|--------|-------|
| `status`      | enum   | `active`, `expired`, `revoked`, `all` (default). Derived: `revoked` → status row is revoked; otherwise `valid_before < now` → `expired`; else `active`. |
| `username`    | string | Substring match against `username` and `principal`. |
| `allocationId`| string | Exact match. |
| `from`        | ISO    | Filter `issued_at >= from`. |
| `to`          | ISO    | Filter `issued_at <= to`. |
| `limit`       | int    | Default unbounded; portal sends 10/20/50. |
| `offset`      | int    | Standard offset paging. |

Response:

```json
{
  "certificates": [ /* Certificate */ ],
  "total": 80,
  "limit": 10,
  "offset": 0
}
```

`total` is the count after filtering, before paging.

### GET /signer/certificates/{serial}

Returns the certificate resource or 404. Serial is the numeric serial number.

### POST /signer/certificates/{serial}/revoke

```json
{ "reason": "Suspected key compromise" }
```

Validation:

- `reason` is required, 3–500 chars.

Behavior:

- Idempotent: revoking an already-revoked certificate returns 409 with
  `{ "error": "already_revoked" }`.
- Successful revoke returns the updated certificate (with `revoked: true`,
  `revoked_at`, `revocation_reason`).

The signer publishes the new KRL (Key Revocation List) to clusters out-of-band.
That side effect is not modeled in the portal contract.

## Authorization

- A regular `user` may list / read their own certificates only. The portal
  enforces this by pinning `username` to the session email; the backend must
  also enforce it (don't trust portal-side filtering).
- `admin` may list / read all certificates and revoke any.
- `pi` / `co_pi` may read certificates on allocations they own (Phase 7
  refinement; current MSW gates only on `username`).

Revoke requires `admin`. PIs revoking certs on their allocations is a Phase 7
extension and not part of the current contract.

## Open questions for the signer team

1. Should the backend support an `issuer` filter so the portal can show
   "certificates issued by your CA only" once multiple CAs land?
2. Bulk revoke for a `client_id` (rotate a pipeline secret + invalidate every
   cert it minted) — Phase 7 want.
3. Streaming a KRL diff for cluster syncing — out of scope for the portal
   surface, but worth a separate doc.
