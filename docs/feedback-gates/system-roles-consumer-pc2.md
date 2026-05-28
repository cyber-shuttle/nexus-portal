# System Roles Consumer — PC2 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-24-nexus-portal-system-roles-consumer.md` §6, §7 (PC2 row), §8
**Backend contract:** `airavata-custos/docs/architecture/2026-05-24-system-roles.md`
**Builds on:** `system-roles-consumer-pc0.md`, `system-roles-consumer-pc1.md`
**Phase:** PC2 — Dev personas + e2e + backend-contracts/auth.md rewrite
**Date:** 2026-05-25

## Scope

Closes the loop on the two-axis model in dev mode. The `admin@nexus.local`
persona now stamps `systemRole: "admin"` on the credentials path so the
admin nav renders end-to-end without a running core backend. New Playwright
e2e proves the dev-persona nav contract. `docs/backend-contracts/auth.md`
is rewritten to remove the v1 claims-based mapping path and codify the
fail-closed-on-DB-unreachable security contract.

## Files modified

| Path | Change |
|---|---|
| `src/shared/auth/auth.ts` | `devPersonas` type widened to allow `systemRole?: SystemRole`; `admin@nexus.local` now carries `systemRole: "admin"`. The credentials `authorize` callback forwards `systemRole: preset.systemRole ?? null` on the returned User. |
| `src/shared/auth/callbacks.ts` | Credentials branch of the `jwt` callback stamps `token.systemRole = user.systemRole ?? null`. Does NOT call `fetchSystemRole` (dev has no real backend with a row for `admin@nexus.local` — the persona object is authoritative). The OIDC + GitHub branches keep PC0's fetch flow unchanged. |
| `src/types/next-auth.d.ts` | `User.systemRole?: SystemRole \| null` added (Session + JWT already carried it from PC0). |
| `docs/backend-contracts/auth.md` | Wholesale rewrite. Documents the two-axis sourcing (DB authoritative, no IdP-claim path), the `X-Custos-User-Id` header convention, the fail-closed semantics, and what dev mode does differently (credentials path stamps systemRole inline, no `/me/system-role` call). Calls out that claims-based mapping is deliberately NOT supported and points at this spec + the backend spec as authoritative. |

## Files created

| Path | Purpose |
|---|---|
| `tests/system-roles-dev.e2e.ts` | Three Playwright tests covering the dev-credentials nav contract: admin persona sees BOTH groups + admin-only items, researcher sees only "My allocations", PI sees only "My allocations". Reuses the existing `loginAs(page, persona)` helper. |
| `docs/feedback-gates/system-roles-consumer-pc2-screenshots/admin-both-groups.png` | Chrome MCP visual QA of the admin sidebar showing `MY ALLOCATIONS` and `SITE ADMINISTRATION` headings side-by-side. |

## Gates

| Gate | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | 431 files / 0 findings |
| `pnpm test` | 60 files / **455 tests passed** (was 453 at end of PC1; +2 net from credentials path test + persona-shape test) |
| `pnpm build` | exit 0; bundle delta within ±20 B on every route vs PC1 baseline |
| Manual `pnpm dev` smoke | Admin persona shows both nav groups; researcher + PI show only "My allocations" |
| Playwright e2e new spec | 3/3 pass |

## Verification — done when (from spec §8)

- [x] Sign-in as the dev `admin` persona produces a session with `systemRole: "admin"` and the allocation arrays from existing fixtures.
- [x] Sign-in as the `pi` persona produces `systemRole: null` and non-empty `myPiAllocations` (delegated to the existing PI persona test in `derivePersonaScopes` — unchanged).
- [x] Sign-in as a user who is BOTH admin and PI shows both "My allocations" and "Site administration" nav sections simultaneously — covered by the admin-persona e2e (the `admin@nexus.local` persona ALSO has a non-empty allocation membership via `derivePersonaScopes`).
- [ ] Setting `systemRole: "admin"` in the browser's session via DevTools does NOT grant admin actions when the backend is the actual gate (verified by hitting a protected backend endpoint and observing 403/503). **Deferred — requires the core backend running with the auth middleware live; covered by the backend's own integration tests at `internal/server/system_role_integration_test.go`.** Portal-side, the conformance is structural: privileged calls flow through the core API; the portal's JWT carries the role only for UI gating per the rewritten `auth.md`.
- [ ] If the core API is unreachable during the `jwt` callback, sign-in still completes but the session shows `systemRole: null`, empty allocation arrays, and a "backend unreachable" banner appears. **PC0 covers the session-state half (verified by unit tests for `fetchSystemRole` rejection paths). The UI banner is not yet implemented — flagged as a follow-up; the data side is correct and the banner is a small additive UI change.**
- [x] All ability tests + e2e tests pass (`pnpm test`, `pnpm test:e2e`).
- [x] `nexus-portal/docs/backend-contracts/auth.md` is updated to remove the v1 "claims-based mapping" path and point at this consumer spec + the backend spec for the canonical flow.

## Carry-overs (post-PC2 follow-ups)

1. **"Backend unreachable" banner.** Surface a portal-wide banner when
   `session.systemRole === null` AND every allocation array is empty AND
   the user is authenticated. Small additive change in `PortalLayout.tsx`.
   Out of scope for PC2; the data is in the session, just not yet rendered.
2. **Live backend smoke test.** Stand up the core API with the auth
   middleware enabled, sign in via OIDC, exercise an admin endpoint, kill
   the DB, retry, observe 503 rather than 403. Validates the fail-closed
   end-to-end at the network seam.
3. **Dual-nav UX review.** Once a real admin-who-is-also-PI uses the
   portal, decide if the side-by-side dual section is comfortable or if a
   persona switcher is needed (separate spec already drafted at
   `airavata-custos/docs/portal/2026-05-24-nexus-portal-persona-switcher.md`).

## Notes for review (before deploy)

Per the user's directive, **no deploy was run for this work**. The
working tree is clean of partial state but contains 17 modified files +
6 untracked (this gate report, PC0/PC1 gate reports, the e2e screenshot
directory, the new e2e spec, `systemRole.ts` helper, its tests). No commits
were made. The user said they want to look it over first.

Suggested commit grouping (4 commits, in dependency order):
1. **Add fetchSystemRole helper + session shape for two-axis auth** — PC0 changes (types, callbacks fetch path, helper, helper tests).
2. **Refactor CASL into allocation + system axes layered together** — PC1 abilities + AbilityProvider + nav grouping + container migrations.
3. **Stamp systemRole on dev admin persona + e2e** — PC2 dev persona + e2e + ability test additions.
4. **Rewrite backend-contracts/auth.md for the two-axis model** — the doc rewrite.

All four are in nexus-portal (personal-space repo, so normal commit autonomy
per `feedback-no-commits` memory). Spec doc itself lives in airavata-custos
and stays uncommitted per the no-commit-in-airavata-custos rule.
