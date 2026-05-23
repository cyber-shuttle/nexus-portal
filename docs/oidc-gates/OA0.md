# Phase OA0 Gate — OIDC + email allowlist implementation + local tests

**Spec:** `airavata-custos/docs/portal/2026-05-23-nexus-portal-oidc-allowlist.md` §3 DoD, §5 implementation outline, §6 OA0.
**Baseline commit:** `08ed5f3 Add Phase TF4 gate report closing team-feedback goal`.
**HEAD commit:** `5d6ac9c Park mouse off-page after login to avoid stray recharts tooltip`.

OA0 wires the production OIDC sign-in path end-to-end behind `PORTAL_AUTH_MODE=oidc`, with the email allowlist enforced in NextAuth's `signIn` callback and the persona pick carried across the IdP round-trip via a short-lived cookie. Dev-mode Credentials sign-in stays untouched.

## Commits in OA0

```
73322be Add allowlist utility for OIDC email gating
46d8520 Require OIDC env vars when auth mode is oidc
1d59e2e Wire OIDC provider with allowlist and persona-cookie callbacks
98ccab7 Add sign-in error banner for non-allowlist OIDC attempts
da1ef1a Remove cluster-email block and branch persona-card to OIDC or dev
146dd1a Document OIDC env vars in provision-vm.sh generator
0adf34f Add e2e coverage for sign-in error banner
e552513 Replace OIDC env non-null assertions with empty-string fallbacks
5d6ac9c Park mouse off-page after login to avoid stray recharts tooltip
```

Nine commits, each `pnpm build` clean. The trailing two are small follow-ups: a Biome `noNonNullAssertion` cleanup on the Keycloak provider config and an e2e-fixture mouse-park to neutralize a layout-shift-induced recharts tooltip on `/home`.

## Files touched

| File | Purpose |
|---|---|
| `src/lib/allowlist.ts` (NEW) | Pure `isEmailAllowed(email, csv)` — case-insensitive, trimmed, fail-closed on empty CSV. |
| `src/lib/__tests__/allowlist.test.ts` (NEW) | Seven cases: exact + case-mismatch hits, whitespace-tolerant CSV, fail-closed on empty/whitespace/null CSV, null/empty email. |
| `src/lib/env.ts` | Adds `NEXUS_ALLOWED_EMAILS` plus a `superRefine` block that requires `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXUS_ALLOWED_EMAILS` only when `PORTAL_AUTH_MODE='oidc'`. Schema exported for testability. |
| `src/lib/__tests__/env.test.ts` (NEW) | Four cases: dev-mode parse OK without OIDC vars, oidc-mode parse OK with all vars, oidc-mode parse fails (asserts each missing var surfaces the contextual error message), whitespace-only values still rejected. |
| `src/shared/auth/auth.ts` | Replaces the prior generic OAuth scaffold with `Keycloak({ id: "oidc", ... })` (locks `/api/auth/callback/oidc` regardless of provider class). Delegates `signIn`/`jwt`/`session` to the extracted callback factory. |
| `src/shared/auth/callbacks.ts` (NEW) | `buildAuthCallbacks({ allowedEmails, oidcEnabled })` factory. `signIn` checks the allowlist for `provider==='oidc'`; denies → returns `/sign-in?error=not_allowed&email=…` redirect URL; otherwise true. `jwt` (on OIDC) reads `nexus_pending_persona` cookie, maps to Role via `personaToRole`, copies email, zeros membership scopes, and clears the cookie. `session` shape unchanged. |
| `src/shared/auth/__tests__/auth-callbacks.test.ts` (NEW) | Eight cases: allowed/denied/case-insensitive/non-OIDC-passthrough/fail-closed on empty allowlist for `signIn`; persona-cookie → role + token-scope + cookie-cleared for admin and pi, default to `user` when cookie missing for `jwt`. Mocks `next/headers` `cookies()` with a stand-in jar. |
| `src/app/(auth)/sign-in/SignInForm.tsx` | Drops the "OR ANY CLUSTER USER" block (divider + Label + Input + Continue button + free-form `submit` handler). Persona cards now branch on `NEXT_PUBLIC_PORTAL_AUTH_MODE`: oidc → writes `nexus_pending_persona` cookie + `signIn("oidc", ...)`; dev → existing Credentials flow with hard-coded persona email. Renders `<SignInErrorBanner email={…}/>` above the cards when `?error=not_allowed`. |
| `src/app/(auth)/sign-in/page.tsx` | Subtitle "Pick a dev persona or enter any cluster email to continue" → "Pick your role to continue" (matches the new card-only UX). |
| `src/app/(auth)/sign-in/SignInErrorBanner.tsx` (NEW) | Destructive-surface alert (border `--nexus-red-200`, bg `--nexus-red-50`, text `--nexus-red-700`) with `role="alert"` + `aria-label="Not on the allowlist"`. Shows the denied email when present and a "Try a different account" button that `signOut({ redirect: false })` then full-reloads to `/sign-in`. |
| `scripts/provision-vm.sh` | The `.env` generator now emits `PORTAL_AUTH_MODE=dev`/`NEXT_PUBLIC_PORTAL_AUTH_MODE=dev` with inline comments pointing the operator to flip to `oidc`. Adds commented placeholders for `OIDC_ISSUER_URL` (Keycloak realm pre-filled), `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `NEXUS_ALLOWED_EMAILS`. The actual client secret + email list stay operator-supplied per VM. |
| `tests/sign-in-error.e2e.ts` (NEW) | Asserts the banner renders for `?error=not_allowed&email=…`, shows the denied email, and surfaces the retry button. Scoped via `aria-label` so Next's route announcer (also `role=alert`) is not matched. |
| `tests/fixtures/personas.ts` | Adds `page.mouse.move(0, 0)` after the post-login redirect. Sign-in layout shrunk after removing the cluster-email block, which shifted the 3rd-button y-coord on `/sign-in` so the post-redirect cursor on `/home` happened to land on a recharts hotspot and surface a tooltip mid-axe scan. Parking the cursor neutralizes the layout-shift dependency for every test using the fixture. |

## Verification commands & output

```bash
pnpm lint
# Checked 404 files in 37ms. No fixes applied.

pnpm typecheck
# (clean — no output)

pnpm test
#  Test Files  52 passed (52)
#       Tests  368 passed (368)

pnpm build
#  ✓ Compiled successfully in 2.2s
#  ✓ Generating static pages (26/26)

pnpm test:e2e --workers=1
# Running 94 tests using 1 worker
#   1 skipped (pre-existing)
#   93 passed (5.3m)
```

Total: 52 unit test files / 368 unit tests + 93 e2e / 1 skip, all green.

### Cross-feature isolation greps (post-OA0)

```bash
grep -rn "from ['\"]@features/" src/features/
# src/features/projects/__tests__/list-container-helpers.test.ts (pre-existing, TF0)
# src/features/allocations/components/AllocationDetailHeader.tsx (pre-existing, same-feature, S3-allowed)

grep -rn "from ['\"]@features/" src/shared/
# (zero)

grep -rnE "from ['\"](@features|@shared)/" src/lib/
# (zero)

grep -rnE "\b(text|bg|border)-nexus-(blue|red|green|amber|gray)-[0-9]+\b" src/
# (zero — every color usage goes through bg-[color:var(--nexus-…)] tokens)
```

Same two pre-existing entries as TF4; zero new. Brand-utility grep zero.

## DoD §3 status (OA0-eligible items)

OA0 owns every DoD item that does **not** require touching the production VM or doing a real CILogon round-trip. The remaining two boxes are explicitly OA1.

- [x] **`/sign-in` page: 3 persona cards. The "OR ANY CLUSTER USER" email-fallback block is removed.** `src/app/(auth)/sign-in/SignInForm.tsx` — the form section, divider, Label, Input, and Continue button are all gone.

- [x] **In OIDC mode (`PORTAL_AUTH_MODE=oidc`): clicking a persona card sets `nexus_pending_persona=<role>` cookie (Max-Age 300s, Path=/, SameSite=Lax, Secure) and triggers `signIn("oidc", { callbackUrl: "/home" })`.** `SignInForm.tsx` `pick(persona)` branch on `process.env.NEXT_PUBLIC_PORTAL_AUTH_MODE === "oidc"`.

- [x] **NextAuth `signIn` callback for the `oidc` provider lower-cases the email claim, splits `NEXUS_ALLOWED_EMAILS` (comma-separated), and either returns `true` (continues) or returns `"/sign-in?error=not_allowed"` (denies).** `src/shared/auth/callbacks.ts` `signIn`; backed by `isEmailAllowed` (case-insensitive + trimmed + fail-closed on empty CSV).

- [x] **NextAuth `jwt` callback reads `nexus_pending_persona` cookie, maps to role (`researcher`|`pi`|`admin`), assigns into the token; downstream session shape unchanged.** `callbacks.ts` `jwt` reads `cookies()` from `next/headers`, calls `personaToRole`, then clears the cookie. Persona name → Role: `researcher → "user"` (matches the existing Role enum where "researcher" is the persona label for role `user`; `personaForAnalytics` round-trips this), `pi → "pi"`, `admin → "admin"`.

- [x] **`personaScopes` derivation still works for OIDC users.** OIDC token gets empty `myMemberProjects` / `myPiProjects` / `myPiAllocations` / `assignedAllocations` arrays — the fail-safe default per spec §4.5. PI/admin OIDC users will see scope-gated surfaces that depend on membership data as empty until backend `/me/scopes` lands; researcher and admin global surfaces work fully.

- [x] **`/sign-in?error=not_allowed` renders a clear access-denied banner with the email shown and a "Try a different account" link that calls `signOut` then routes back to `/sign-in`.** `src/app/(auth)/sign-in/SignInErrorBanner.tsx`. The retry handler calls `signOut({ redirect: false })` then full-reloads `/sign-in` (drops the error query string).

- [x] **Local dev (`PORTAL_AUTH_MODE=dev`) unchanged: persona cards still drive the Credentials provider; no CILogon round trip.** `SignInForm.tsx` non-oidc branch keeps the original Credentials sign-in flow with hard-coded persona emails. `tests/auth.e2e.ts` (researcher/pi/admin) all pass.

- [DEFERRED to OA1] **Production VM `.env` updated.** `provision-vm.sh` documents the four vars as commented placeholders; the actual values are operator-supplied per spec §5.5 — the implementer never commits the secret.

- [DEFERRED to OA1] **Production deploy via `./deploy.sh`; verified end-to-end with a real CILogon login through Keycloak.** Out of OA0 scope per §6.

- [DEFERRED to OA1] **Manual: allowed user lands as their chosen persona; not-allowed user sees banner; sidebar nav + CASL reflect the chosen role.** OA0 covers all three paths via unit + e2e tests against the dev IdP-free harness. Live walkthrough is OA1.

- [x] **Cross-feature isolation greps stay zero.** See greps above — zero new entries.

- [x] **`pnpm verify` + `pnpm test:e2e --workers=1` green.** Verified above.

- [x] **All commits in `nexus-portal`; nothing in `airavata-custos`.** `git log --oneline 08ed5f3..HEAD` runs cleanly inside `nexus-portal`; no concurrent edits to `airavata-custos`.

**Total: 8 PASS, 3 DEFERRED-to-OA1.** All three deferred items require the live VM and a real Keycloak/CILogon account; per spec §6 OA1 those are Lahiru's manual verification protocol after he flips `.env` and the implementer runs `./deploy.sh`.

## Backend / live-IdP considerations

- The OIDC provider class is `Keycloak` from `next-auth/providers/keycloak` (NextAuth v5). Despite the name, the provider is configured purely by `issuer` URL + `clientId` + `clientSecret` and speaks standard OIDC discovery — no Keycloak-specific assumptions. CILogon-via-Keycloak federation is transparent to the portal.
- `id: "oidc"` lock guarantees `/api/auth/callback/oidc` as the stable callback path; Keycloak admin must register `https://nexus.devportal.cybershuttle.org/api/auth/callback/oidc` per spec §9.
- Env schema fails fast at portal boot if any required OIDC var is missing or whitespace-only when `PORTAL_AUTH_MODE=oidc` — a misconfigured `.env` cannot silently boot in degraded mode.
- Empty allowlist denies everyone (`isEmailAllowed` returns `false`). Tested unit-level + at the callback level.

## Open items for OA1

- **Lahiru updates `/opt/nexus-portal/.env`** on the VM: flip `PORTAL_AUTH_MODE`/`NEXT_PUBLIC_PORTAL_AUTH_MODE` to `oidc`, uncomment + fill `OIDC_ISSUER_URL=https://auth.dev.cybershuttle.org/realms/default`, `OIDC_CLIENT_ID=dev-nexus-portal`, `OIDC_CLIENT_SECRET=<from Keycloak admin>`, `NEXUS_ALLOWED_EMAILS=<8-entry list per spec §5.5>`.
- **Run `./deploy.sh`** from the local repo to push the OA0 build to the VM.
- **Manual verification protocol per spec §6 OA1 step 3:** three persona cards visible, no cluster-email block; allowed CILogon → land on `/home` as chosen role with correct sidebar; sign out + pick a different persona; incognito non-allowlist sign-in → bounce to banner.
- **Write `docs/oidc-gates/OA1.md`** with deploy output tail, curl checks (`/sign-in` 200, protected route 302 → `/sign-in`), confirmation `PORTAL_AUTH_MODE=oidc` is live.

## Sign-off

- [ ] QA visual review (Chrome MCP at 1440×900 on the sign-in page in both dev and a synthetic `?error=not_allowed` URL).
- [ ] Architect review (callback factory + env schema + persona-cookie protocol; spec §4.3 + §4.4 + §9 risk matrix).
