# Backend contract — auth

The portal authorizes users on **two independent axes**, both sourced from
the Custos core DB. IdP claims are NEVER trusted for authorization.

- **Allocation axis** — `role` plus the allocation/project scope arrays
  (`myPiAllocations`, `assignedAllocations`, `myPiProjects`,
  `myMemberProjects`). Derived from membership in the core DB.
- **System axis** — `systemRole`. Currently single-valued (`"admin"` or
  `null`); the union is open to additional tiers as they're added.

The two axes are layered together by `defineAbility(session)` in
`src/shared/casl/abilities.ts`. Both always feed CASL; no persona switcher,
no client-side toggle.

**Authoritative specs:**
- Backend: `airavata-custos/docs/architecture/2026-05-24-system-roles.md`
- Consumer (this side): `airavata-custos/docs/portal/2026-05-24-nexus-portal-system-roles-consumer.md`

## How the portal populates the session at sign-in

NextAuth `jwt` callback (`src/shared/auth/callbacks.ts`) does, on each fresh
sign-in (real providers only — `oidc`, `github`):

1. **Verify the OIDC/OAuth token** via the provider (NextAuth handles this).
2. **Call `GET /me/system-role`** on the core API.
   - URL: `${CORE_API_BASE_URL}/me/system-role`
   - Header: `X-Custos-User-Id: <userId>` — the core never verifies the JWT
     itself; the portal is the JWT-verification seam, and this header is
     the seam where a future JWT-verification middleware will plug in.
   - Response (200): `{"role": "admin"}` or `{"role": null}`.
   - Response (401): missing header — defensive, portal always sends it.
   - Response (503): DB lookup failed — fail-closed (see below).
3. **Call `GET /me/scopes`** on the core API for the allocation axis
   (existing path, unchanged). Same `X-Custos-User-Id` header. Returns
   `{role, myPiAllocations, assignedAllocations, myPiProjects, myMemberProjects}`.

## Fail-closed semantics

On ANY failure of either call (network rejection, timeout, 401, 503, 5xx,
non-2xx, JSON parse error, contract-violation parse error):

- `session.systemRole = null`
- All allocation scope arrays = `[]`
- `console.warn` logs a single line so operators see it
- The sign-in itself **still succeeds** — the user is authenticated; they
  just have no scopes until the core API recovers.

The portal NEVER falls back to IdP claims for authorization. A wedged
backend produces a no-scopes session, not an elevated one. This closes
the "claim fallback if DB unreachable" attack the prior model permitted
(security review, 2026-05-24).

UI signal (planned): a "backend unreachable" banner surfaces when
`systemRole === null` AND allocation arrays are all empty AND the user is
authenticated. Telegraphs the cause to the user without exposing details.

## Dev mode (`PORTAL_AUTH_MODE=dev`)

The `Credentials` provider in `src/shared/auth/auth.ts` uses hard-coded
personas (`researcher@nexus.local`, `pi@nexus.local`, `admin@nexus.local`).
Dev mode does NOT call `/me/system-role` — the persona's `systemRole` field
in `devPersonas` is authoritative:

```ts
"admin@nexus.local": { name: "Avery Admin", role: "user", systemRole: "admin" },
```

Other dev personas produce `systemRole: null` (the default). The allocation
axis is derived from `derivePersonaScopes()` against the MSW seed, as
before. The MSW `/me/scopes` mock at `src/mocks/handlers/users.ts` continues
to back dev-mode allocation-axis fetches if the dev jwt callback ever needs
them; the credentials path itself just stamps from the persona object.

## What the real backend must ship

- **`GET /me/system-role`** as specified in
  `airavata-custos/docs/architecture/2026-05-24-system-roles.md` §5.4. Auth
  via `X-Custos-User-Id`. Returns `{role: "admin"}` or `{role: null}` or
  503. 5s cache TTL inside the core, invalidated on grant/revoke (already
  implemented in `internal/server/system_role.go`).
- **`GET /me/scopes`** with the same auth header. Reads from
  `compute_allocation_memberships` and projects. Same fail-closed contract.

## What's deliberately NOT supported

- **JWT claims for authorization.** The portal will not read `nexus_admin`,
  `nexus_role`, `realm_access.roles`, or any other claim. The DB is the
  authorization source of truth. The previous claims-based mapping
  (documented in the pre-2026-05-24 version of this file) is removed.
- **Persona switcher.** An admin who is also a PI sees both nav sections
  simultaneously. If real users find the dual-nav confusing, a switcher is
  a future additive change (consumer spec §5).
- **Client-side cache of `systemRole`.** Every privileged backend request
  is re-authorized server-side against the DB; the JWT carries the role
  for UI gating only.
