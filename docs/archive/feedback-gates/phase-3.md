# Feedback Mode — Phase 3 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-23-nexus-portal-feedback-mode.md`
**Phase:** 3 — Server route + GitHub submission (with MSW)
**Date:** 2026-05-23

## Deliverables shipped

| Deliverable | Path | Status |
|---|---|---|
| Server-only GitHub REST wrappers + typed errors | `src/features/feedback/githubClient.ts` (158 LOC) | done |
| Markdown body + title formatters (with/without screenshot) | `src/features/feedback/issueBody.ts` (122 LOC) | done |
| Real POST handler: auth + zod + GH + dev mock path | `src/app/api/feedback/route.ts` (114 LOC) | done — replaces 501 stub |
| MSW handlers intercepting GitHub Contents + Issues | `src/mocks/handlers/feedback-github.ts` | done — registered in `handlers/index.ts` |
| Client submit handler — real success path + toast action | `src/features/feedback/FeedbackPanel.tsx` (modified) | done — stub path removed |
| Vitest unit tests for `githubClient` | `src/features/feedback/__tests__/githubClient.test.ts` | done — 11 tests |
| Vitest unit tests for `issueBody` + snapshots | `src/features/feedback/__tests__/issueBody.test.ts` | done — 5 tests |
| Token-leak canary test | `src/features/feedback/__tests__/no-client-token-leak.test.ts` | done — 2 tests |
| Vitest stub for `server-only` import | `vitest.server-only-stub.ts` + alias in `vitest.config.ts` | done |
| `server-only` npm dep | `package.json` | added (`server-only@0.0.1`) |

## Architecture decisions

- **`server-only` guard.** `githubClient.ts` opens with `import "server-only"` — Next bundles this dep with a marker that errors at build time if the module ever ends up in a client bundle. Made tests work by aliasing the import to an empty stub in `vitest.config.ts`.
- **Token name appears only on server-side files + tests.** `githubClient.ts` takes a `cfg: { token, repo }` arg instead of reading `serverEnv` directly — so the *constant name* `FEEDBACK_GITHUB_TOKEN` only appears in `src/lib/env.ts` (schema), `src/app/api/feedback/route.ts` (route handler), and the token-leak test. This is a tighter blast radius than the brief sketched (the brief assumed githubClient would reference the env var name).
- **Reporter email override before validation.** The brief said "override the client's claimed `reporterEmail` with `session.user.email`" after parsing. Implemented as a pre-validation stamp instead: the Phase 2 client sends `reporterEmail: "unknown@local"` which fails zod's email format check (zod 4 requires a TLD). Stamping the session email onto the raw JSON before `safeParse` makes the validation pass for any client-supplied placeholder while still discarding spoofed identities. Same security outcome; doesn't require touching the Phase 2 client.
- **Dev-mode short-circuit.** When `FEEDBACK_GITHUB_TOKEN` is unset and `NODE_ENV !== 'production'`, route returns a `MOCK-<uuid>` issueUrl with `issueNumber: 0` — no fetch, no MSW interception needed in the dev runtime (per the brief's "Server-side fetch + MSW caveat" guidance). MSW handlers are wired for unit + e2e use only.
- **Error translation.** `GithubAuthError` → 503 "service misconfigured"; `GithubNotFoundError` → 503 "repo not found"; everything else → 502 "github upstream error". Token never appears in responses or in any visible logs (console.error keeps detail, never the token).
- **Client toast contract.** Success → `toast.success("Suggestion filed as #<n>", { action: { label: "View on GitHub", onClick: window.open } })` and close panel. Mock issueUrl detected via `/issues/MOCK-` substring → toast body gets `(dev mock)` suffix. Failure → keep panel open, `toast.error` + inline `submitError`.

## Bundle delta vs. Phase 2 baseline

| Route | Phase 2 First-Load JS | Phase 3 First-Load JS | Delta |
|---|---|---|---|
| `/projects` | 222 kB | **222 kB** | 0 kB |
| `/home` | 171 kB | **171 kB** | 0 kB |
| `/allocations` | 201 kB | **201 kB** | 0 kB |
| Shared chunks | 103 kB | **103 kB** | 0 kB |

Within ±2 kB budget. The new server route + githubClient + issueBody live entirely in the Node runtime; no client-side delta.

## Test counts

| Phase | Test files | Tests |
|---|---|---|
| Phase 2 baseline | 53 | 372 |
| Phase 3 | 56 | **391** (+19) |

New tests: `githubClient.test.ts` (11), `issueBody.test.ts` (5 — including 2 snapshots), `no-client-token-leak.test.ts` (2). All passing.

## Gate evidence

```text
$ pnpm typecheck   # exit 0
$ pnpm lint        # Checked 419 files. No fixes applied. exit 0
$ pnpm test        # Test Files 56 passed (56), Tests 391 passed (391)
$ pnpm build       # ✓ Compiled successfully; first-load JS table identical to Phase 2
```

### Curl smoke (dev server on port 3003, no FEEDBACK_GITHUB_TOKEN in env)

**401 — no session cookie:**

```http
HTTP/1.1 401 Unauthorized
content-type: application/json

{"ok":false,"error":"unauthorized"}
```

**400 — comment shorter than 10 chars (authenticated as `researcher@nexus.local`):**

```http
HTTP/1.1 400 Bad Request
content-type: application/json

{"ok":false,"error":"invalid payload","issues":{"formErrors":[],"fieldErrors":{"comment":["Invalid input"]}}}
```

**200 — valid payload, no token (dev mock):**

```http
HTTP/1.1 200 OK
content-type: application/json

{"ok":true,"issueUrl":"https://github.com/lahirujayathilake/nexus-portal/issues/MOCK-b0355a6c-304a-44e5-99bc-f4a71103fe02","issueNumber":0}
```

Server log line: `FEEDBACK_GITHUB_TOKEN not set — returning mock issue URL (dev only)` (matches the spec's dev-mode console.warn requirement).

### Chrome MCP end-to-end verification

Dev server on `http://localhost:3003`, signed in as `researcher@nexus.local` via the dev FAB carry-over from Phase 2.

| # | Screenshot | Verifies |
|---|---|---|
| 1 | `phase-3-screenshots/submit-success-toast.png` | `/projects` → Suggestion mode → drew one rect → "With screenshot phase 3 success toast." (36 chars) → Submit. Sonner toast top-right: **"Suggestion filed (dev mock)"** with **"View on GitHub"** action button. Panel auto-closed; underlying page restored and interactive. |
| 2 | `phase-3-screenshots/text-only-success-toast.png` | Same flow, but clicked "Remove screenshot" first → text-only banner → "Text-only phase 3 success toast." (32 chars) → Submit. Same success toast appears with the **(dev mock)** suffix; "View on GitHub" action present; panel closes. |

A11y snapshot of the toast region confirms the action renders as a real `button` element and the toast body is read as `StaticText "Suggestion filed (dev mock)"` — accessible without relying on the screenshot.

### Token-leak grep

```
$ grep -rE "FEEDBACK_GITHUB_TOKEN" src/
src/app/api/feedback/route.ts:    if (!serverEnv.FEEDBACK_GITHUB_TOKEN) {
src/app/api/feedback/route.ts:        console.error("FEEDBACK_GITHUB_TOKEN missing in production");
src/app/api/feedback/route.ts:      console.warn("FEEDBACK_GITHUB_TOKEN not set — returning mock issue URL (dev only)");
src/app/api/feedback/route.ts:    const cfg = { token: serverEnv.FEEDBACK_GITHUB_TOKEN, repo: serverEnv.FEEDBACK_GITHUB_REPO };
src/features/feedback/__tests__/no-client-token-leak.test.ts:const TOKEN = "FEEDBACK_GITHUB_TOKEN";
src/features/feedback/__tests__/no-client-token-leak.test.ts:describe("no client-side FEEDBACK_GITHUB_TOKEN leak", () => {
src/features/feedback/__tests__/no-client-token-leak.test.ts:  it("every file referencing FEEDBACK_GITHUB_TOKEN is either env.ts or server-only", () => {
src/features/feedback/__tests__/no-client-token-leak.test.ts:  it("no 'use client' file references FEEDBACK_GITHUB_TOKEN", () => {
src/lib/env.ts:    FEEDBACK_GITHUB_TOKEN: z.string().min(20).optional(),
src/lib/env.ts:    // Feedback widget enforces FEEDBACK_GITHUB_TOKEN inside the POST handler
```

Three production files (`env.ts`, route handler) + one test file. Zero `"use client"` files reference the token. (`githubClient.ts` takes the token via its `cfg` arg, so the *literal string* never lands in that file — a stricter outcome than the brief sketched.)

## Drift from the brief

1. **Pre-validation reporterEmail stamp** instead of post-parse override. See architecture note above; same security guarantee, doesn't require client changes.
2. **`server-only` was not previously installed.** Added as a dep (`server-only@0.0.1`) and aliased to a noop in `vitest.config.ts` so unit tests can import the module. Next's bundler still enforces the client-import barrier at build time.
3. **Token literal does not appear in `githubClient.ts`.** The brief expected it would, but routing the token through a `cfg` arg keeps the constant name out of the feature module entirely — only `route.ts` (the boundary) and `env.ts` (the schema) need to know the name.
4. **Toast duplicated "(dev mock) (dev mock)" suffix on first attempt.** Caught during Chrome MCP verification — both the `issueNumber === 0` branch AND the mock-detection branch were appending the suffix. Simplified to one source of truth (mock detection only).

## Surprises from the existing code

- `auth()` returns the expected `{ user: { email } }` shape from Phase 2's NextAuth wiring (`src/shared/auth/auth.ts`). Credentials provider was already wired; signing in via curl worked with a single `csrfToken` → `callback/credentials` round-trip.
- The Phase 2 client sends `reporterEmail: "unknown@local"` which zod 4's `.email()` validator rejects (it now requires a TLD). The pre-validation stamp side-steps this without modifying Phase 2 behavior.
- Chrome MCP `take_screenshot` (viewport-only) cropped out the sonner toast region in the bottom-right; `fullPage: true` was required to capture it consistently.

## Files touched

```
A src/features/feedback/githubClient.ts
A src/features/feedback/issueBody.ts
A src/features/feedback/__tests__/githubClient.test.ts
A src/features/feedback/__tests__/issueBody.test.ts
A src/features/feedback/__tests__/no-client-token-leak.test.ts
A src/features/feedback/__tests__/__snapshots__/issueBody.test.ts.snap
A src/mocks/handlers/feedback-github.ts
M src/app/api/feedback/route.ts                  (replaced 501 stub with real handler)
M src/features/feedback/FeedbackPanel.tsx        (stub-success branch removed)
M src/mocks/handlers/index.ts                    (registered feedback-github handlers)
M package.json                                   (+ server-only dep)
M pnpm-lock.yaml
M vitest.config.ts                               (alias server-only to stub)
A vitest.server-only-stub.ts
A docs/feedback-gates/phase-3.md                 (this file)
A docs/feedback-gates/phase-3-screenshots/{submit-success-toast,text-only-success-toast}.png
```

## Carry-overs to Phase 4

None blocking. Notes:
- Context payload is still stubbed in the client (persona `unknown`, empty outline). Phase 4 owns the real capture (`componentOutline.ts`, `consoleBuffer.ts`).
- MSW handlers for GitHub are wired but only used by the `server`-based test runtime; the dev `MswProvider` browser worker doesn't intercept route-handler `fetch()` calls. This was the intended design per the brief.
- Toast duration uses sonner defaults (~4s); if Phase 4 a11y review wants a longer window for screen-reader announcements, bump via toast options.

Status: **gate passed**. Phase 4 unblocked.
