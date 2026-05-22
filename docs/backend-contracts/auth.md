# Backend contract — auth

The portal supports two NextAuth providers (`PORTAL_AUTH_MODE=dev` or
`oidc`). Both produce the same `Session` shape; the difference is how
authorization scopes are derived.

## OIDC scope mapping

When `PORTAL_AUTH_MODE=oidc`, the JWT callback in `src/shared/auth/auth.ts`
derives the user's CASL `Role` and allocation scopes in this order:

1. **Claim-based.** The portal looks for, in order:
   - `nexus_admin` (boolean or string `"true"`) → `Role` = `admin`.
   - `nexus_role` (string) → must match one of
     `guest|user|pi|co_pi|allocation_manager|admin`.
   - `realm_access.roles` (array, Keycloak-style) containing
     `nexus_admin` → `Role` = `admin`.
2. **Fallback to `/me/scopes`.** If no claim is present, the portal calls
   `GET ${CORE_API_BASE_URL}/me/scopes` with the OIDC access token.
   Expected response:

   ```json
   {
     "role": "pi",
     "myPiAllocations": ["alloc-001", "alloc-002"],
     "assignedAllocations": ["alloc-015"]
   }
   ```

   - `role` must be one of the values above; an unknown role degrades to
     `user`.
   - `myPiAllocations` and `assignedAllocations` are arrays of
     `ComputeAllocation.id`. They feed CASL's `ctx.myPiAllocations` and
     `ctx.assignedAllocations` and drive subject-aware abilities (PI
     manages own memberships, allocation managers approve assigned change
     requests, etc.).
3. **Last-resort default.** If both fail, `Role` = `user` and both
   allocation lists are empty.

MSW exposes a deterministic `/me/scopes` for dev (`src/mocks/handlers/users.ts`):
it routes off the `?user=` query param and reuses `derivePersonaScopes()` so
the persona's allocation membership in the seed produces stable scopes.

## What the real backend should ship

- A `/me/scopes` endpoint as above on the core service. Reads from
  `compute_allocation_memberships` and the role override flag.
- If the IdP supports custom claims, prefer claims-based mapping
  (`nexus_role` + `nexus_admin`) over a round-trip. The portal is happy
  with either.

## Open questions

- Should claims-based admin override allocation-membership-derived `pi`
  scopes? Today the portal short-circuits to admin (empty PI lists) on
  the admin claim. If a real human is both a PI and a site admin and
  needs both nav surfaces, we should switch to additive mapping.
- The `/me/scopes` fallback is unauthenticated in MSW. Production must
  authenticate with the bearer token (already passed through by the
  portal).
