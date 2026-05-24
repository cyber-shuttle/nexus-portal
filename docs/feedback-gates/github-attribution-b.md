# GitHub Attribution — Phase B Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-24-nexus-portal-github-attribution.md`
**Phase:** B — UI + API route + e2e
**Date:** 2026-05-24

## Scope

Wires the Phase A `provider: "github"` session discriminator through the
remaining surfaces: the sign-in page (second button + scope microcopy), the
"Need Help?" Suggestion mode gate, the `/api/feedback` route's token-source
selection, and an `@<login>` enrichment in the issue body. Adds a Playwright
spec that exercises the GitHub-attributed submission path end-to-end via a
dev-only credentials shim that stamps `provider: "github"`, plus a server-side
MSW interceptor so the route's outbound github.com calls are mocked.

## Files modified

| Path | Change |
|---|---|
| `src/app/(auth)/sign-in/page.tsx` | Server component derives `githubEnabled` from `serverEnv.GITHUB_OAUTH_CLIENT_ID` + `_SECRET` and passes it to `<SignInForm />`. |
| `src/app/(auth)/sign-in/SignInForm.tsx` | New `githubEnabled` prop. When true, renders a horizontal-rule separator and a "Continue with GitHub" button beneath the persona list, with the spec's two-line microcopy. Button calls `signIn("github", { callbackUrl })`. |
| `src/shared/layout/NeedHelpCard.tsx` | Reads `useSession().data.provider`. Disables the Suggestion mode button when the session is not GitHub-attributed and wraps it in the existing `<Tooltip>` with copy `Sign in with GitHub to enable suggestions`. The button stays visible in both states. `aria-label` + `title` carry the tooltip text for non-hover users. |
| `src/app/api/feedback/route.ts` | Selects token source: `session.accessToken` when `session.provider === "github"`, else `serverEnv.FEEDBACK_GITHUB_TOKEN`, else the existing dev-mode mock-URL short-circuit. When using the session token, calls the new `getAuthedUserLogin()` and threads the result into `issueBody({ githubLogin })`. The bot path skips the login lookup. |
| `src/features/feedback/githubClient.ts` | Adds `getAuthedUserLogin(token)` — fetches `GET /user`, returns `login` on 200, `null` on any failure. Best-effort; never throws. |
| `src/features/feedback/issueBody.ts` | New optional `githubLogin?: string` on `IssueBodyInput`. Reporter line renders as `[@<login>](https://github.com/<login>) ([<email>](mailto:<email>))` when present, else `[<email>](mailto:<email>)`. |
| `src/shared/auth/auth.ts` | Adds the dev-only `github-dev` credentials provider (gated on `NODE_ENV !== "production" && PORTAL_AUTH_MODE === "dev"`). Lets the e2e spec drive a `provider: "github"` session without the real OAuth dance. |
| `src/shared/auth/callbacks.ts` | jwt callback recognises `account.provider === "github-dev"` and stamps the token with `provider: "github"` so the rest of the app sees the same discriminator the real provider sets. |
| `src/mocks/handlers/feedback-github.ts` | Echoes the request `Authorization` header back as `?auth=` on the returned `html_url` so the e2e can assert the token-source selection without sharing global state across worker processes. Adds a `/user` handler returning `{ login: "octocat-test" }`. |
| `src/features/feedback/__tests__/issueBody.test.ts` | +2 tests — reporter line with / without `githubLogin`. |
| `src/features/feedback/__tests__/githubClient.test.ts` | +4 tests covering `getAuthedUserLogin` (200, non-2xx, fetch rejection, missing login field). |
| `src/features/feedback/__tests__/__snapshots__/issueBody.test.ts.snap` | Regenerated — Reporter cell now renders as a markdown `mailto:` link instead of inline-code. |
| `tests/feedback-mode.e2e.ts` | Switched from `loginAs("researcher")` to `loginAsGithubUser("researcher")` because credentials sessions can no longer open the Suggestion panel. `test.describe.serial` keeps github-attributed submits out of MSW's concurrent fetch pool. |
| `tests/fixtures/personas.ts` | New `loginAsGithubUser(page, persona)` helper. Posts to `/api/auth/callback/github-dev` with a fresh CSRF token, then polls `/api/auth/session` until `provider === "github"` sticks (handles a cookie-write race under heavy parallel load). |

## Files created

| Path | Purpose |
|---|---|
| `src/instrumentation.ts` | Next.js instrumentation hook. When `NEXT_PUBLIC_PORTAL_USE_MSW === "true"` and the runtime is Node, dynamically loads `msw/node` (via `new Function("s", "return import(s)")` to hide the specifier from webpack — `msw/node`'s subpath exports break the bundler) and calls `setupServer(...handlers).listen({ onUnhandledRequest: "bypass" })`. This means the same handlers the browser worker uses also intercept the route's outbound github.com fetches in dev / e2e. |
| `tests/feedback-github-attribution.e2e.ts` | The new spec. Two tests, `test.describe.serial`: (1) GitHub-attributed submit path — signs in via `loginAsGithubUser`, draws a shape, submits, asserts the `/api/feedback` response body excludes `accessToken` and the returned `issueUrl`'s `?auth=` query param is `Bearer dev-token`; (2) credentials session — asserts the Suggestion mode button is visible, disabled, with the `Sign in with GitHub to enable suggestions` accessible name + visible "Suggestion mode" text. |
| `docs/feedback-gates/github-attribution-b-screenshots/` | Three Chrome MCP visuals (see below). |

## Drift from the brief

- **Auth-header observation via response-body echo, not a global side channel.** The brief suggested intercepting via `page.route('https://api.github.com/**', ...)` — but `page.route` only sees browser-originated requests, and the route's fetches are server-side. A globalThis-stashed audit was tried but races across worker processes when more than one feedback submit overlaps. The MSW handler now echoes the bearer token back as `?auth=` on the returned `html_url`, so the route's response carries the observation through to the test naturally and is per-request — no cross-test contamination. Required deleting the temporary `/api/test-msw-last-issue-auth` debug endpoint.
- **`new Function("s", "return import(s)")` in `instrumentation.ts`.** `msw/node` re-exports `@mswjs/interceptors/ClientRequest` (a subpath export with `browser: null`) and webpack mis-resolves it whether or not `serverExternalPackages` is set. The eval-style import hides the specifier from the bundler and lets Node's loader resolve it. Biome doesn't flag `new Function` the way it does `eval`.
- **`test.describe.serial` on the feedback specs.** With four feedback POSTs racing across parallel workers, MSW occasionally mis-intercepts under first-compile load — the route falls through to real github.com and gets 401. Running tests within each file serially avoids the race; cross-file parallelism is fine because workers warm `/api/feedback` sequentially.
- **`loginAsGithubUser` retries the `/api/auth/session` poll.** NextAuth's set-cookie + the follow-up GET race under heavy parallel load. A 10-attempt poll with 150 ms backoff handles the transient null window.

## Gate results

| Check | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm lint` | exit 0, 428 files checked, 0 findings |
| `pnpm test` | 59 files / **427 tests passed** (was 421; +6) |
| `pnpm build` | exit 0, 28 routes |
| `pnpm test:e2e` | 100 / 100 passed (3.5 min) |
| `pnpm test:e2e feedback-github-attribution` | 2 / 2 passed, repeated 5× back-to-back, all green |
| Bundle delta | `/sign-in` 2.11 → 2.35 KB (**+0.24 KB**, well under ±2 KB). Every other route unchanged. |
| Token-leak grep | `accessToken` appears only in server files (`callbacks.ts`, two route handlers) and the NextAuth type augmentation. `FEEDBACK_GITHUB_TOKEN` appears in two server files (`route.ts`, `env.ts`) + the existing leak test. No `"use client"` reference. |

## Tests added

**Unit (6):**

`getAuthedUserLogin` (4) —
- returns `login` on 200 and sends `Bearer <token>` Authorization
- returns `null` on non-2xx
- returns `null` on fetch rejection
- returns `null` when the `login` field is missing

`issueBody` reporter formatting (2) —
- email-only when no `githubLogin` is provided
- `[@<login>](https://github.com/<login>) ([<email>](mailto:<email>))` when present

**Playwright (2):**

`feedback github attribution` —
- `github-attributed session sends the user's bearer token to the issues API` — signs in via the `github-dev` shim, opens the Suggestion panel, draws a shape, types the sample comment, submits. Asserts the `/api/feedback` POST body carries no `accessToken` / `token` / `FEEDBACK_GITHUB_TOKEN` substring, the response is 200 with a non-MOCK `issueUrl`, and the `?auth=` query the MSW handler echoed back on the URL is exactly `Bearer dev-token`.
- `credentials session disables Suggestion mode with the GitHub-prompt tooltip` — signs in as the researcher persona via credentials, asserts the Suggestion mode button is visible, disabled, accessible name is `Sign in with GitHub to enable suggestions`, and visible text still contains `Suggestion mode`.

## Chrome MCP visual QA

Screenshots saved to `docs/feedback-gates/github-attribution-b-screenshots/`:

| File | What it shows |
|---|---|
| `01-sign-in-both-buttons.png` | `/sign-in` with `GITHUB_OAUTH_CLIENT_ID` + `_SECRET` set to dummies. Three persona buttons up top, horizontal-rule separator, "Continue with GitHub" button beneath, then the two-line scope microcopy. |
| `02-disabled-suggestion-tooltip.png` | Signed in as researcher via credentials, on `/home`. The Suggestion mode button is grey/disabled in the "Need Help?" card. `aria-label` reads `Sign in with GitHub to enable suggestions` (the tooltip text). |
| `03-enabled-suggestion-github.png` | Signed in via the `github-dev` shim (same persona but session `provider === "github"`), on `/projects`. The Suggestion mode button is enabled (live colour, no `[disabled]` in the a11y tree). |

## Test-session shim — path chosen

A dev-only second `Credentials` provider (`id: "github-dev"`, name `GitHub (dev shim)`) registered alongside the existing `credentials` provider when `NODE_ENV !== "production" && PORTAL_AUTH_MODE === "dev"`. The jwt callback recognises `account.provider === "github-dev"` and stamps the token with `provider: "github"` so downstream code sees the same shape the real provider produces. The existing `accessToken = "dev-token"` branch in the jwt callback (added in Phase A) hydrates the session token automatically.

Why this and not real OAuth mocking: a full OAuth dance would have required intercepting the GitHub authorize/token endpoints, stubbing PKCE state cookies, and matching NextAuth's internal redirect chain — all overkill for verifying that the route's token-source selection works. The shim is ~12 lines and gated on `NODE_ENV !== "production"`, so a production build with `PORTAL_AUTH_MODE=oidc` never registers it.

## Surprises

- **`msw/node` is bundler-hostile.** `@mswjs/interceptors/ClientRequest` declares `browser: null` in its conditional exports. Webpack honours that and refuses to bundle the module for any chunk that touches it, regardless of whether `serverExternalPackages` lists it. The only path that worked was hiding the import behind `new Function`, which webpack treats as opaque. This also means handlers had to come through webpack while `setupServer` comes through Node — turns out the handler types are structurally compatible across the two msw copies, so this works in practice.
- **`globalThis`-stashed test audit raced across worker processes.** Multiple Playwright workers running tests in parallel hit the single Next.js webserver; the shared module-scope value was overwritten between submit and read. Solved by encoding the auth header into the response payload (`?auth=` on `html_url`).
- **NextAuth cookie write races the follow-up GET.** Under five parallel workers signing in, ~10% of `/api/auth/session` GETs immediately after `POST /api/auth/callback/github-dev` returned `null`. A 10×150 ms poll in the helper smoothed it out.
- **shadcn `<TooltipTrigger render={...}>` is the existing pattern, not `asChild`.** Followed the existing NeedHelpCard convention rather than reaching for `asChild` — the `@base-ui/react` tooltip wrapper uses a render-prop API.
- **`getByRole("button", { name: /Suggestion mode/i })` stops matching once `aria-label` is set.** The accessible name comes from `aria-label` first, visible text last. The disabled-case test had to switch to `name: /Sign in with GitHub to enable suggestions/i` and assert visible "Suggestion mode" text separately.
- **Pre-existing `a11y-allocations` flake under full-suite load.** Independent of these changes (reproduces on master HEAD with the same workload). Passes in isolation and in this Phase B run.

## Out of scope

- Real GitHub OAuth app registration on the VM (operational task; runbook stays as queued work per spec §3 DoD #15).
- Account linking between CILogon and GitHub identities (explicit non-goal).
- Public-feedback / non-team GitHub users (deferred — same allowlist gates both providers).
