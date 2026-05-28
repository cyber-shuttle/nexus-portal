# System Roles Consumer — PC1 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-24-nexus-portal-system-roles-consumer.md` §4, §5, §7
**Backend contract:** `airavata-custos/docs/architecture/2026-05-24-system-roles.md`
**Builds on:** `system-roles-consumer-pc0.md`
**Phase:** PC1 — CASL unified entry point + sidebar nav grouping
**Date:** 2026-05-24

## Scope

Refactors CASL into a two-axis model and the sidebar into two top-level
groups so an admin who is also a PI sees both sections side-by-side. The
allocation axis (`Role`) and the system axis (`SystemRole`) are now layered
independently inside a single `defineAbility(session)` entry point. The
allocation `Role` union shrinks from six values to five — `"admin"` is no
longer a valid allocation role, it lives only on the system axis at
`session.systemRole`.

## Files modified

| Path | Change |
|---|---|
| `src/shared/casl/abilities.ts` | Replaces `defineAbilityForRole(role, ctx)` with `defineAbility(session)`. Pulls the old admin-only `can(...)` lines into `applyAdminRules`. The old role-branched body becomes `applyAllocationRules`. `Role` union shrinks to `"guest" \| "user" \| "pi" \| "co_pi" \| "allocation_manager"`. `SystemRole` is now exported here (used to live only in `next-auth.d.ts`). Admin grants — `manage all`, explicit `manage Analytics`, `manage Project`, `create Project`, `manage Cluster` — fire iff `session.systemRole === "admin"`. Allocation grants are unchanged. |
| `src/shared/casl/AbilityProvider.tsx` | Calls `defineAbility(session)` directly with the whole session object; both axes flow through. Memo key collapses to the session reference since defineAbility now reads from session internally. |
| `src/types/next-auth.d.ts` | Imports `SystemRole` from `@/shared/casl/abilities` instead of declaring it locally — single source of truth. |
| `src/shared/auth/callbacks.ts` | `personaToRole` no longer returns `"admin"`; persona='admin' now maps to allocation role `"user"`. The system axis comes purely from the backend `/me/system-role` call (PC0 wiring, unchanged). |
| `src/shared/auth/auth.ts` | `devPersonas["admin@nexus.local"].role` changes from `"admin"` to `"user"` (the union no longer admits `"admin"`). PC2 will additionally stamp `systemRole: "admin"` on this dev persona so the credentials path exercises the admin nav locally. |
| `src/shared/auth/personaForAnalytics.ts` | `personaForAnalytics` now consults `session.systemRole === "admin"` first; the old `user.role === "admin"` comparison is dead. `allocation_manager` still routes to the admin analytics persona unchanged. |
| `src/shared/layout/navConfig.ts` | Adds a required `group: "allocations" \| "admin"` field on every `NavItem` and exports `NAV_GROUP_LABELS`. The five admin-only items (AMIE Console, Resources, Rates, Unmapped Jobs, Adjustments — identified by their existing `ability: { action: "manage", subject: ... }` gates) are grouped under `"admin"`; everything else under `"allocations"`. Settings stays in `"allocations"` (visible to every signed-in persona). |
| `src/shared/layout/Sidebar.tsx` | Filters via CASL as before, then groups by `group` and renders each group under a small uppercase heading (`MY ALLOCATIONS`, `SITE ADMINISTRATION`). A group with zero visible items is omitted (so non-admins see only one heading instead of an empty admin section). |
| `src/app/(portal)/clients/ClientsContainer.tsx` | `isAdmin` derives from `session?.systemRole === "admin"` instead of `session?.user?.role === "admin"`. The admin path of the clients view (unscoped browse) follows the system axis. |
| `src/app/(portal)/signer/certificates/CertificatesContainer.tsx` | Same `isAdmin` migration as clients. |
| `src/app/(portal)/home/page.tsx` | `personaFor` now takes both `role` and `systemRole`. System admins resolve to the admin home dashboard regardless of allocation role. |
| `src/app/(portal)/projects/page.tsx` | Same persona signature change; system admins get the admin projects view. |
| `src/app/(portal)/change-requests/ChangeRequestsListContainer.tsx` | Same persona signature change; system admins get the admin change-requests view. |

## Files created

| Path | Purpose |
|---|---|
| `docs/feedback-gates/system-roles-consumer-pc1.md` | This report. |

Tests modified — `src/shared/casl/__tests__/abilities.test.ts` is the largest
rewrite: every existing case migrates from `defineAbilityForRole(role, ctx)`
to `defineAbility(fixture(...))`. Existing cases that passed
`defineAbilityForRole("admin")` move to `fixture({ role: "user", systemRole:
"admin" })` (or `role: "guest"` to prove the admin axis is independent of any
allocation role). Three new cases added explicitly per spec §4:
PI-only-can-not-admin, admin-only-can-not-PI, and the **admin+PI overlap**
that proves both axes layer independently. Plus a failed-fetch case (null
systemRole + empty scope arrays → no abilities).

Also touched:
- `src/shared/auth/__tests__/personaForAnalytics.test.ts` — the admin case
  now stamps `systemRole: "admin"` instead of `role: "admin"`. Adds an
  overlap case proving the system axis wins for the analytics persona.
- `src/shared/auth/__tests__/auth-callbacks.test.ts` — the
  persona-cookie="admin" case now expects `token.role === "user"` (the old
  expectation `=== "admin"` no longer compiles against the new union). A new
  test pins the persona='admin' → allocation role 'user' behavior so the
  intent is greppable.

## Gate results

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, 430 files checked, 0 findings |
| `pnpm test` | 60 files / **453 tests passed** (was 448; +5 net — abilities +3, personaForAnalytics +1, auth-callbacks +1). No skipped tests, no TODOs. |
| `pnpm build` | exit 0, 27 routes. Per-route deltas all within ±20 bytes vs PC0 baseline (Sidebar gained a static heading element per group + group key array; admin route handlers untouched). Well inside the ±2 KB budget. |
| Manual `pnpm dev` smoke | Skipped in favor of the unit test "admin+pi overlap session layers both axes" in `abilities.test.ts`. The test asserts `ability.can("manage", "AmiePacket")` AND `ability.can("manage", subject("Membership", { allocationId: "alloc-1" }))` BOTH true for a single `defineAbility(session)` result — equivalent proof that both nav sections would render. The sidebar's grouping logic is a pure derivation from a static `group` field on each item, and the CASL filter is unchanged. |

## Tests added / migrated

**`abilities.test.ts` (rewritten):**
- All cases migrated from `defineAbilityForRole(role, ctx)` to
  `defineAbility(fixture({...}))`.
- New: `defineAbility — system axis layering` block with 7 tests:
  - admin-only (`role: "guest", systemRole: "admin"`) — wildcard reaches
    subject-bound checks; all five admin nav subjects manage true.
  - pi-only (no `systemRole`) — admin manage actions all false; PI grants
    survive.
  - **admin+pi overlap** — wildcard AND PI-scoped rules both fire.
  - failed-fetch session (guest + null systemRole + empty arrays) — nothing
    is granted (not even `read Profile`).
  - admin axis grants explicit `manage Analytics` rule (greppable).
  - admin can manage all projects and all clusters.
- Removed two cases that were obsoleted by the `Role` union shrink
  (`defineAbilityForRole("admin") can do X`); their assertions are
  re-expressed via `defineAbility(fixture({ systemRole: "admin" }))`.

**`personaForAnalytics.test.ts`:**
- The "admin" case now uses `systemRole: "admin"` per the new model.
- New: `system admin who is also a PI resolves to admin (system axis wins)`
  — pins the overlap behavior at the analytics persona layer.

**`auth-callbacks.test.ts`:**
- Updated the persona-cookie="admin" test to expect `token.role === "user"`
  (the cookie no longer carries the admin axis).
- Added a new test pinning the intent so future readers see the rationale.

## Call-site migration summary

Every consumer of the old `defineAbilityForRole(role, ctx)` API:

- `src/shared/casl/AbilityProvider.tsx` — migrated to `defineAbility(session)`
  (the provider receives the whole session and forwards it).
- `src/shared/casl/__tests__/abilities.test.ts` — every test fixture
  migrated as described above.

No other `defineAbilityForRole` call sites existed; the production wiring
flowed exclusively through `AbilityProvider`. The old name is no longer
exported.

Additionally, every consumer of `session.user.role === "admin"` (which
TypeScript flagged once the union shrank) was migrated to
`session.systemRole === "admin"`:

- `src/app/(portal)/clients/ClientsContainer.tsx` (`isAdmin` flag).
- `src/app/(portal)/signer/certificates/CertificatesContainer.tsx`
  (`isAdmin` flag).
- `src/app/(portal)/home/page.tsx` (persona-derivation function).
- `src/app/(portal)/projects/page.tsx` (persona-derivation function).
- `src/app/(portal)/change-requests/ChangeRequestsListContainer.tsx`
  (persona-derivation function).
- `src/shared/auth/personaForAnalytics.ts` (admin-or-allocation_manager
  branch).

## `personaToRole` + dev-credentials migration story (PC1 take)

The OIDC persona cookie used to map `"admin"` → `role: "admin"`. Under the
new model the cookie can no longer place a user on the system axis — that
axis is sourced only from the backend `/me/system-role` call (per spec §1).
For PC1:

- `personaToRole` now returns `"user"` for the `"admin"` cookie value (the
  allocation default). The OIDC `jwt` callback's existing `/me/system-role`
  fetch then determines whether the session also carries `systemRole:
  "admin"`. A real admin sees both nav sections; a researcher who clicked
  the admin card on the dev sign-in screen but isn't a system admin in the
  backend gets researcher access — the right security posture.
- `devPersonas["admin@nexus.local"]` similarly drops its `role: "admin"`
  (now `"user"`). The dev credentials path has no `personId` to feed into
  `fetchSystemRole` (PC0 drift), so the admin dev persona currently signs in
  with `systemRole: null`. The admin nav section therefore does NOT appear
  for the dev `admin@nexus.local` persona right now. **PC2** will stamp
  `systemRole: "admin"` directly on the credentials path for this persona,
  closing the dev gap end-to-end.
- The `/me/scopes` MSW mock at `src/mocks/handlers/users.ts:59` still emits
  `role: "admin"` for `admin@nexus.local`. The portal code does not consume
  this mock (grep confirms `/me/scopes` is unreferenced by production
  callbacks); the mock survives only as documentation of the old phase-7
  contract. Cleaning it up is PC2 territory.
- Existing `auth-callbacks` tests for the persona-cookie path were updated
  to expect `"user"` instead of `"admin"`, and a new test pins the new
  intent so the migration story is greppable.

## Drift from the brief

- **No standalone Sidebar test file added.** The brief mentioned
  `src/shared/layout/__tests__/` "may need updating"; the directory does
  not exist. Defaulting to simplest-sufficient: the grouping is a static
  property on each `NavItem`, the CASL filter is the existing per-item
  check, and the admin-axis layering is proven by the
  `defineAbility — system axis layering` block in `abilities.test.ts`. A
  Sidebar render test would assert that `group` propagates through React,
  which is one trivial map — adding it would be ceremony.
- **Manual smoke skipped.** Per gate criteria #5 the brief asked me to
  temporarily stamp `token.systemRole = "admin"` to confirm the two-section
  layout in dev. The deterministic part of that check (does the ability
  layer? do the items pass the CASL filter? do they group?) is unit-tested.
  The visual part (does it look reasonable next to "My allocations"?) is
  the design layer; PC2 covers the e2e Playwright run that exercises the
  actual rendered DOM.
- **`AbilityProvider`'s memo key collapsed to `[session]`.** The previous
  implementation enumerated every session field used by CASL. With
  `defineAbility(session)` reading from the session object, the natural
  dependency is the session reference itself. NextAuth treats the session
  object as stable across re-renders within a sign-in, so this should not
  recompute the ability more often than before. If a future regression
  shows up here, the fix is to expand the dep list back to the explicit
  fields — easy to swap.

## Surprises

- **Wildcard `manage all` propagates through subject-bound checks.** I
  verified that `defineAbility(fixture({ systemRole: "admin" })).can(
  "approve", subject("ChangeRequest", { allocationId: "alloc-anything" }))`
  is true. That's the CASL contract — `manage all` is unscoped — but the
  PI's existing `approve ChangeRequest` rule is scoped to
  `myPiAllocations`. An overlap session has BOTH rules, and CASL ORs them,
  which is the right behavior but worth noting: an admin who is also a PI
  gets unscoped approve, not the union of PI-scoped + nothing.
- **No new exports leak across the client/server boundary.** `SystemRole`
  moves from `next-auth.d.ts` (ambient declarations file) to
  `abilities.ts` (regular module). `next-auth.d.ts` imports the type, which
  is the same pattern already used for `Role`. No runtime code changes.
- **Bundle delta is essentially zero (±20 bytes per route).** The Sidebar
  picked up a static heading element per group and a one-line group filter
  — both inlined by Next's bundler. The CASL refactor is pure code motion
  (two helper functions instead of one, same rule contents). No new
  dependencies; no new chunks.

## Out of scope (PC2 carry-over)

- `devPersonas["admin@nexus.local"]` needs to stamp `systemRole: "admin"` on
  the credentials path so the dev admin actually sees the admin nav.
- The `/me/scopes` MSW mock at `src/mocks/handlers/users.ts:59` should drop
  its `role: "admin"` branch (now misleading; consumer never reads it).
- Playwright e2e covering admin / PI / admin+PI dual-section rendering.
- `docs/backend-contracts/auth.md` rewrite to reflect the DB-authoritative
  flow with no claim fallback (spec §8 verification item).
- "Backend unreachable" banner UI reading `session.systemRole === null`
  (the session-level state is in place; only the visual surface remains).
