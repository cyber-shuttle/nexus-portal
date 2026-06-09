# GitHub Attribution — Phase A Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-24-nexus-portal-github-attribution.md`
**Phase:** A — Auth provider + allowlist + session plumbing
**Date:** 2026-05-24

## Scope

Adds a third NextAuth provider — GitHub OAuth — alongside the existing
`credentials` (dev) and `oidc` (CILogon/Keycloak) providers. The new provider
is gated on the pair `GITHUB_OAUTH_CLIENT_ID` + `GITHUB_OAUTH_CLIENT_SECRET`
being set; if either is missing it never registers and the topology is
unchanged from prior phases. No UI, no API-route changes, no e2e — those
land in Phase B.

## Files modified

| Path | Change |
|---|---|
| `src/lib/env.ts` | Declared `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` as optional server-side vars. No `superRefine` clause — GitHub is purely additive, so a half-set pair just leaves the provider unregistered. |
| `src/shared/auth/auth.ts` | Imported `next-auth/providers/github`. Computed `githubEnabled = !!(serverEnv.GITHUB_OAUTH_CLIENT_ID && serverEnv.GITHUB_OAUTH_CLIENT_SECRET)`. Appended a third spread into the `providers` array that registers `GitHub({...})` with `authorization.params.scope = "repo user:email"`. |
| `src/shared/auth/callbacks.ts` | Extended `signIn` with a `github` branch — fetches `https://api.github.com/user/emails` with the user's access token, admits if ANY verified address (plus the primary user-info email) is in the allowlist, returns the standard `/sign-in?error=not_allowed&email=…` redirect otherwise. Fail-closed on fetch error or non-2xx. Extended `jwt` to stamp `token.provider` on all three branches (`oidc`/`github`/`credentials`); GitHub branch copies `email` + `name`, defaults `role: "user"`, zeros scope arrays (mirrors the OIDC pattern so CASL gates deny by default). Extended `session` to copy `token.provider` onto `session.provider`. |
| `src/types/next-auth.d.ts` | Added `provider?: "github" \| "oidc" \| "credentials"` to both `Session` and `JWT` augmentations via a shared `AuthProviderKind` alias. |
| `scripts/provision-vm.sh` | Appended commented `GITHUB_OAUTH_CLIENT_ID=` / `GITHUB_OAUTH_CLIENT_SECRET=` placeholders to the `.env` heredoc, with a 3-line comment explaining the OAuth-app registration step at https://github.com/settings/developers. |
| `.env.example` | Same vars + a one-paragraph note in the FEEDBACK_*-block style. |
| `src/shared/auth/__tests__/auth-callbacks.test.ts` | +11 tests (see Tests section). |

## Files created

None. (Gate report `docs/feedback-gates/github-attribution-a.md` aside.)

## Drift from the brief

- **No `githubEnabled` plumbed into `buildAuthCallbacks`.** The callbacks
  already key everything off `account?.provider === "github"` at call time,
  so the boot-time flag would be redundant. Skipped per the brief's "decide
  based on what the callbacks need to know" clause.
- **Test for the "credentials returns true" path stayed put.** My new `signIn`
  structure (explicit `oidc` / `github` branches, fall-through `return true`)
  preserves the same behaviour as the old `if (provider !== "oidc") return true`
  predicate. The existing test passes unchanged.
- **`provider` stamped on the credentials branch only when `user` is present.**
  The `jwt` callback runs on every token refresh, not just at sign-in. Stamping
  the discriminator only inside the per-branch `user` guard (matching the OIDC
  pattern) means it sticks to the token at sign-in and is preserved by NextAuth
  on subsequent refresh calls. Verified end-to-end below.

## Gate results

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, 426 files checked, 0 findings |
| `pnpm test` | 59 files / **421 tests passed** (was 410; +11) |
| `pnpm build` | exit 0, 27 static pages generated |
| Bundle delta | **0 KB** on every route (verified pre/post via `git stash` round-trip) |
| Token-leak grep | `grep -rE 'GITHUB_OAUTH_(CLIENT_ID\|CLIENT_SECRET)' src/` returns only `src/lib/env.ts` (2) + `src/shared/auth/auth.ts` (3). No client references. |

## Tests added (11)

In `src/shared/auth/__tests__/auth-callbacks.test.ts`:

`describe("jwt callback", ...)` — +2

- stamps `provider: "credentials"` and copies user scopes on the credentials path
- stamps `provider: "github"`, defaults `role: "user"`, copies `email` + `name`, zeros scopes, persists `accessToken` from `account.access_token`
- (existing OIDC test extended with a `token.provider === "oidc"` assertion)

`describe("session callback", ...)` — +2 (new block)

- exposes `token.provider` on `session.provider`
- leaves `session.provider` undefined when the token has none (back-compat)

`describe("signIn callback — github", ...)` — +7 (new block, `vi.spyOn(globalThis, "fetch")`)

- admits when a non-primary verified email is in the allowlist (the design's primary motivating case)
- rejects when no verified email is in the allowlist
- ignores unverified addresses even if they're in the allowlist
- rejects with the standard redirect on `fetch` rejection (network down)
- rejects on non-2xx GitHub response (401 / bad token)
- rejects without a network call when the access token is missing
- admits when the user-info-claim primary email is in the allowlist even if `/user/emails` omits it

## Manual smoke (dev mode, GitHub vars unset)

```
PORT=3013 pnpm dev
curl /api/auth/providers → { credentials: {...} }   # only credentials registered
POST /api/auth/callback/credentials → 302
curl /api/auth/session → {
  user: { email: "researcher@nexus.local", role: "user", ... },
  accessToken: "dev-token",
  provider: "credentials"           # discriminator stamped end-to-end
}
```

No regressions from prior phases. `session.provider` is exposed exactly as
the spec requires; Phase B can gate the Suggest button on
`session?.provider === "github"` directly.

## Out of scope (Phase B)

- `/sign-in` second button + microcopy
- `NeedHelpCard` Suggest-button gate
- `/api/feedback` token-source selection (session vs bot PAT)
- `issueBody` @username plumbing
- Playwright e2e
- VM env update + smoke

## Code-comment posture

All new comments are why-only, max 2 lines, no process references — per the
session memory rule. Comments live in: the GitHub provider's `authorization`
block (scope rationale), the fail-closed branch when the access token is
missing, and the GitHub `jwt` branch's empty-scopes initialisation.

## Notes for the next agent

- `session.accessToken` flows through automatically for GitHub via the existing
  `if (account?.access_token) { token.accessToken = ... }` branch — no change
  required there for Phase B's API-route work. The route just reads
  `session.accessToken` when `session.provider === "github"`.
- The `/user/emails` call lowercases addresses before returning, matching
  `isEmailAllowed`'s case-insensitive contract.
- `next-auth/providers/github` is already in `node_modules` (transitive of
  `next-auth@5.0.0-beta.31`'s package exports). No `pnpm add` needed.
