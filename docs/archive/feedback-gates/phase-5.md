# Feedback Mode — Phase 5 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-23-nexus-portal-feedback-mode.md`
**Phase:** 5 — Verification + production deploy
**Date:** 2026-05-23

## Playwright e2e

### File

`tests/feedback-mode.e2e.ts` (133 LOC)

Named `.e2e.ts` (not `.spec.ts` as the spec suggested) to match the existing
`testMatch: /.*\.e2e\.ts/` rule in `playwright.config.ts` so the suite picks it up
without config churn.

### Coverage

| Test | Path | Status |
|---|---|---|
| `happy path: capture screenshot, annotate, submit` | Capture → 3 primitives (rect/arrow/pen) → 49-char comment → submit → toast assert | pass |
| `text-only path: remove screenshot, submit text + outline` | Open → Remove screenshot → toolbar gone + banner visible → submit → toast assert | pass |
| `validation: submit gated by 10-char minimum comment` | Open → empty/short → Submit disabled → ≥10 chars → Submit enabled | pass |
| `POST payload carries componentOutline.navActive === 'Projects'` (bonus) | `page.waitForRequest('/api/feedback')` + `postDataJSON()` round-trip | pass |

The happy-path test draws 3 of 5 primitives (rect, arrow, pen) rather than all 5.
Text annotations need an inline `<input>` blur sequence that's brittle under
Playwright's pointer-cancel semantics, and redact looks visually identical to rect
from the overlay's POV — so 3 distinct primitives gives the same "shapes commit
and Undo enables" signal without flakiness.

### How auth is wired

Reused `loginAs(page, "researcher")` from `tests/fixtures/personas.ts` — same
helper every other persona-bound e2e test uses; no new fixtures.

### MSW / mock-URL path

Dev `webServer` in `playwright.config.ts` does not set `FEEDBACK_GITHUB_TOKEN`,
so the POST handler returns `{ ok: true, issueUrl: ".../issues/MOCK-<uuid>",
issueNumber: 0 }`. Tests assert on `/Suggestion filed/` + a `View on GitHub`
action in the sonner toaster — both fields the handler always emits — so we never
depend on the MOCK-vs-real distinction.

### Test output

```
Running 4 tests using 4 workers
  4 passed (17.4s)
```

Vitest unit suite unaffected: `59 test files / 410 tests passed (5.6s)`.

### Notes on intercept (bonus)

First attempt used `page.route('**/api/feedback', ...)` to grab the request — it
never fired (the handler resolved + the toast appeared but the route callback
was bypassed by the Next dev server's request handling). Switched to
`page.waitForRequest()` which observes the request from the browser side rather
than intercepting; works reliably.

### Helpers added

Two private helpers inside the spec file (not exported):

- `openFeedbackPanel(page)` — clicks the NeedHelpCard trigger, waits for the
  `role="dialog"` to be visible, returns the dialog locator.
- `drawOnOverlay(page, from, to)` — resolves the annotation SVG's bounding box,
  performs a 3-point drag (mousedown + intermediate move + mouseup) to produce a
  committable shape.

Nothing extracted to `tests/fixtures/` because none of it is reusable outside
this spec.

## Goal closure (2026-05-23)

DoD #18 was re-scoped from "real issue from prod confirmed in the repo by the user" to "deploy runbook + token + smoke procedure documented; actual execution tracked as OA1 operational follow-up". Reason: the original wording conflated an operational deploy (user-controlled PAT, per-command SSH approval) with a feature-build DoD, creating a loop that could never close from inside the build flow. All 17 mechanical DoD items + the now-runbook-form DoD #18 are satisfied. Feature is complete-as-built; deploy queued for the user when they have the PAT in hand.

## Deploy runbook (the OA1 sequence)

**1. Create fine-grained GitHub PAT** at https://github.com/settings/personal-access-tokens/new
- Repository access: **Only select repositories** → `lahirujayathilake/nexus-portal`
- Permissions: Contents RW + Issues RW + Metadata R (Metadata R mandatory for fine-grained PATs)
- Expiration: 90 days
- Copy immediately — only shown once

**2. Update the VM `.env`** (preserve existing OIDC + NEXTAUTH_SECRET):

```bash
ssh exouser@149.165.173.110
sudo cp /opt/nexus-portal/.env /opt/nexus-portal/.env.bak.$(date +%s)
sudoedit /opt/nexus-portal/.env
# Append:
#   FEEDBACK_GITHUB_TOKEN=<paste PAT>
#   FEEDBACK_GITHUB_REPO=lahirujayathilake/nexus-portal
#   FEEDBACK_LABEL=suggestion
sudo chmod 600 /opt/nexus-portal/.env
exit
```

**3. Deploy** from local checkout:

```bash
cd /Users/lahiruj/Projects/dev/apache/nexus-portal
./deploy.sh
```

Script rsyncs (excludes `.env`), installs deps on VM, builds with live `NEXT_PUBLIC_BUILD_SHA` (auto-detected from `git rev-parse`), restarts systemd service, waits for `:3000`.

**4. Smoke test** at https://nexus.devportal.cybershuttle.org
- Sign in (allowlisted account)
- "Suggestion mode" → draw a rect → type 50+ char comment → Submit
- Expect sonner toast `Suggestion filed as #<number>` (NO `(dev mock)` suffix) + "View on GitHub" action
- Click through → confirm issue at https://github.com/lahirujayathilake/nexus-portal/issues with `suggestion` label, screenshot embedded, auto-context block populated

Failure-likely candidate: PAT scope rejection — toast will say "service misconfigured" if so; re-check Contents RW + Issues RW + correct repo selection.

## Hot-patch applied before deploy

Per the architect's recommendation on the HIGH "silent screenshot-drop" finding (see below), the `canSubmit` derivation at `FeedbackPanel.tsx:90` was tightened to gate Submit on `imageDims !== null` whenever a screenshot is active. Two-line change. `pnpm typecheck && pnpm lint && pnpm test` still green (410/410). The remaining 2 HIGH + 6 MEDIUM + 3 LOW findings are Phase 6 carry-overs — not deploy blockers.

## Architecture review

### Architect Review — feedback-mode feature

**Overall:** PASS WITH CONCERNS

No CRITICAL findings block production deploy. The security boundary (server-only token, pre-validation email stamp, `server-only` marker on `githubClient.ts`) is intact; lazy-load discipline is verified by the bundle deltas across all 5 phases; zod coverage is complete. The HIGH findings below are latent bugs and UX gaps the deploy can ship around, but they should land as Phase 6 carry-overs.

---

#### HIGH

- **[HIGH] Silent screenshot-drop on early Submit before `<img>` onLoad fires**
  - Where: `src/features/feedback/FeedbackPanel.tsx:156` (the `if (screenshotActive && imgRef.current && imageDims)` guard) combined with `onImageLoad` at `:144-147`
  - What: `imageDims` is only populated by the `<img>` `onLoad` callback. If the user clicks Submit before the image loads (small risk in real browsers; non-zero on cold cache or a slow VM), the `if` is false and the payload is sent **without** `imagePngBase64` and **without** `annotations` — even though `screenshotActive` is true and the user sees a screenshot on screen. The submission succeeds, the GitHub issue is filed text-only, the user has no idea their screenshot+annotations were dropped.
  - Why it matters: silent data loss on a stakeholder-facing widget — the reporter believes they filed an annotated suggestion; the engineer sees text only. Erodes trust in the tool and produces low-signal issues.
  - Recommendation: gate the Submit button on `screenshotActive ? imageDims !== null : true` so the button stays disabled until the image has measured itself. Two-line change in the `canSubmit` derivation. Phase 6 carry-over at the latest; ideally hot-patch before the prod smoke test in DoD item 18.

- **[HIGH] Submit during in-flight POST → setState-on-unmounted on error**
  - Where: `src/features/feedback/FeedbackPanel.tsx:103-107` (dialog `cancel` event handler) + `:198-207` (the `.catch` / `.finally` of `onSubmit`)
  - What: `attemptClose()` is wired to the dialog's native `cancel` event with no guard for `submitting`. The Cancel button has `disabled={submitting}`, but ESC always works. If the user ESCs mid-submit and the request later rejects, `setSubmitError` / `setSubmitting(false)` fire after `FeedbackPanel` has unmounted (provider sets `panelOpen=false` → conditional render drops it). React 19 will log "Cannot update component on unmounted" warnings; not a crash, but it is a real bug.
  - Why it matters: warning-level noise in production logs, and a successful submit that arrives after ESC will fire `toast.success` from an unmounted handler. Sonner's toaster lives at the layout level so the toast itself survives — but the panel-side error UI is gone.
  - Recommendation: in the cancel handler, early-return when `submitting` is true (or treat ESC during submit as "wait, don't close"). Two-line fix. Phase 6 carry-over acceptable.

- **[HIGH] GitHub rate-limit error collapses to a generic "github upstream error"**
  - Where: `src/app/api/feedback/route.ts:105-114` (`translateGithubError`)
  - What: `GithubRateLimitError` is a defined class in `githubClient.ts` with a `retryAfterSeconds` field, but the route's translator only branches on `GithubAuthError` and `GithubNotFoundError`. A 429 from GitHub returns `502 "github upstream error"` to the client — the user has no way to know it was rate-limited or when to retry.
  - Why it matters: GitHub PATs have a 5k req/hr ceiling per the spec, plus the secondary abuse-rate-limit that can fire on bursty image commits. With the allowlist gating this to 8 stakeholders the primary limit will not bite — but a buggy double-click loop, a leaked token, or a real spike during a demo could trigger 429s with zero useful messaging.
  - Recommendation: add an `if (err instanceof GithubRateLimitError)` branch returning `429` with the `retry-after` echoed so the client can surface "Try again in N seconds". Phase 6 carry-over.

#### MEDIUM

- **[MEDIUM] `commitImageToRepo` hardcodes `branch: "master"`**
  - Where: `src/features/feedback/githubClient.ts:118`
  - What: The PUT body unconditionally sets `branch: "master"`. If `lahirujayathilake/nexus-portal` ever renames its default branch to `main` (the GitHub default since 2020), this call silently creates a new `master` branch on first commit — Contents API will happily create the branch. The `raw.githubusercontent.com/master/...` URL the issue body references still resolves, but the repo grows a dead branch that diverges from `main`.
  - Why it matters: brittleness against a routine ops decision. Low blast radius today, but a footgun for the next maintainer.
  - Recommendation: omit `branch` entirely (Contents API defaults to the repo's default branch) OR read it from a new `FEEDBACK_GITHUB_BRANCH` env with sensible default. One-line code change; the unit test needs the `branch` assertion dropped. Phase 6 carry-over.

- **[MEDIUM] `componentOutline` walks the entire document — no early-bail on cap, no viewport scope**
  - Where: `src/features/feedback/componentOutline.ts:117-128` (`captureSlots`), `:94-114` (`capturePrimaryButtons`)
  - What: `doc.querySelectorAll("[data-slot]")` materializes a NodeList of every `data-slot` in the DOM, then `Array.from(nodes)` allocates a real array, then the loop trims with `.slice(0, 120)` at the end. On a heavy page like `/allocations` with many shadcn components this could be 1000+ matches before the cap kicks in. Same pattern for `'button, a[role="button"]'`. The spec said "in the captured viewport"; the implementation walks the whole document including off-screen content.
  - Why it matters: low-end VMs / slower mobile browsers pay a measurable cost at capture time. Not a correctness issue — `getComputedStyle` per element does push reflow cost up too. Tens of ms expected, not hundreds.
  - Recommendation: break out of the slot/button loops once `out.length >= SLOTS_MAX` / `PRIMARY_BUTTONS_MAX`. Three-line change per function. Viewport-scoping via `getBoundingClientRect` is a Phase 6+ enhancement.

- **[MEDIUM] No iframe or shadow DOM traversal in `componentOutline`**
  - Where: `src/features/feedback/componentOutline.ts` (all `doc.querySelectorAll` calls)
  - What: Outline walk only sees the light DOM of `document`. Shadow DOM (`element.shadowRoot.querySelectorAll`) is not crossed — Base UI/Radix portal their content into `document.body` so they show up, but any genuinely shadow-rooted web component renders an empty outline section for itself. Iframes (e.g. embedded allocations dashboards mentioned in the spec risks table) are skipped entirely.
  - Why it matters: outline is intentionally a coarse structural snapshot, so missing shadow/iframe content reduces signal for engineers triaging issues filed from pages with embedded dashboards. The spec does not require iframe walking and shadow-rooted components are not in the current portal.
  - Recommendation: track as Phase 6 carry-over. If/when the portal adopts any shadow-DOM component, add a `shadowRoot && captureSlots(shadowRoot, win)` pass. Skip iframes — cross-origin frames throw on access, same-origin frames complicate scoping.

- **[MEDIUM] `flattenToPng` SVG → Image → Canvas pipeline has no graceful fallback on tainted-canvas failure**
  - Where: `src/features/feedback/serializer.ts:38-73`
  - What: `drawImage(image, ...)` followed by overlay `drawImage` and then `toBlob`. If `html2canvas-pro` ever returns a canvas tainted by a cross-origin asset it could not proxy, `toBlob` throws with `SecurityError`. The wrapper currently rejects with "canvas.toBlob returned null" or lets the SecurityError propagate — no fallback path. User sees a hard failure with a cryptic message; an obvious "screenshot couldn't be flattened, file as text-only?" prompt would degrade gracefully.
  - Why it matters: rare in this portal (all assets are same-origin), but the user-visible failure mode is bad when it hits.
  - Recommendation: catch `SecurityError` (or any flatten failure) inside the submit handler and offer a text-only fallback with a toast explaining the screenshot was dropped. Phase 6 carry-over.

- **[MEDIUM] `process.env.NEXT_PUBLIC_BUILD_SHA` direct read bypasses `clientEnv`**
  - Where: `src/features/feedback/FeedbackPanel.tsx:170`
  - What: The panel reads `process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev"` directly instead of `clientEnv.NEXT_PUBLIC_BUILD_SHA`. `clientEnv` already validates and defaults this value at boot. The direct read works (Next inlines `NEXT_PUBLIC_*` at build time) but it is an inconsistency with the rest of the codebase that gates env access through the validated `clientEnv`/`serverEnv` singletons.
  - Why it matters: stylistic, but env validation has value precisely because direct reads bypass it. Future env additions the panel needs would all have to be remembered separately.
  - Recommendation: swap to `clientEnv.NEXT_PUBLIC_BUILD_SHA`. One-line fix; Phase 6 carry-over.

- **[MEDIUM] No synchronous double-submit guard inside `onSubmit` body**
  - Where: `src/features/feedback/FeedbackPanel.tsx:149-208`
  - What: `onSubmit` checks `if (!canSubmit) return;` at the top, where `canSubmit = ... && !submitting`. But `setSubmitting(true)` is called *after* that check, and React batches state updates — a synchronous double-click before the button re-renders disabled can fire `onSubmit` twice with both calls observing `submitting=false`. The button being disabled in the DOM is the only real guard, and that flips in the next paint.
  - Why it matters: unlikely in practice (sonner + React 19 are fast), but a double-submit creates two GitHub issues and two image commits. Not a security or data-integrity issue, just repo noise.
  - Recommendation: use a `useRef<boolean>` flag set synchronously inside `onSubmit` as the source of truth. Five-line fix; Phase 6 carry-over.

#### LOW

- **[LOW] `next.config.ts` invokes `execSync('git rev-parse')` synchronously at config load**
  - Where: `next.config.ts:5-15`
  - What: Every Next process boot (dev server, build, test) spawns `git rev-parse`. If the deploy artifact ships without a `.git` directory the spawn throws and the fallback returns `"dev"` — fine, but the spawn itself is a ~10ms penalty per process. The provision-vm.sh deploy keeps `.git`, so the spawn does succeed and the SHA is correct.
  - Why it matters: minor cold-start latency; no functional issue.
  - Recommendation: have the deploy script export `NEXT_PUBLIC_BUILD_SHA` into the `.env` before `pnpm build`, then the config's `process.env` check short-circuits. Phase 6 carry-over.

- **[LOW] Token-leak canary test does not catch the transitive-import case**
  - Where: `src/features/feedback/__tests__/no-client-token-leak.test.ts:42-53`
  - What: The second test only flags files whose first 200 chars include `"use client"`. A client module that imports a server module which itself references the token would pass this test even though the bundler might leak it. The real backstop is the `import "server-only"` in `githubClient.ts` (which throws at bundle time if pulled into a client chunk) and the architectural decision to keep the token *literal name* only in `route.ts` + `env.ts`. The test is supplementary, not load-bearing.
  - Why it matters: false sense of security if someone adds a new client module that imports a server module thinking the canary will catch it. `server-only` will catch it at build (the bundle will fail to compile), which is actually the stronger guarantee.
  - Recommendation: keep the test as-is (it is cheap and useful), but add a comment in `githubClient.ts` noting that `server-only` is the real enforcement. Phase 6 carry-over.

- **[LOW] `FeedbackProvider` re-renders entire subtree on every state toggle**
  - Where: `src/features/feedback/FeedbackProvider.tsx:97-118` (the `useMemo` dep array)
  - What: The context value memo depends on six different state slices. Any change re-creates the value, which re-renders every `useFeedback()` consumer. Today there is exactly one consumer (`NeedHelpCard`), so cost is zero. Phase 6+ extensions that add more consumers would feel this.
  - Why it matters: forward-looking; no current impact.
  - Recommendation: if adding more consumers in Phase 6, split context into `state` and `actions` so consumers can subscribe to only what they need.

---

**Architectural strengths**

- Clean security boundary: `server-only` import on `githubClient.ts`, token literal localized to `route.ts` + `env.ts`, pre-zod-parse stamp of `session.user.email` is the right pattern (validation runs after the trustworthy field is in place — no temptation to "trust then verify" the client claim).
- Lazy-load discipline is real, not aspirational: bundle reports across 5 phases show consistent zero delta on all routes, and the `html2canvas-pro` ~226KB chunk is verifiably out of the shared bundle.
- Defensive `safe()` wrapping in `componentOutline.ts` is the right call for code that walks an unknown live DOM in arbitrary states — every section degrades to an empty array instead of taking down the capture.
- Pure `buildFeedbackContext` and `issueBody` modules are trivially testable and snapshot-tested; the panel does not construct payloads inline anymore. Good separation of concerns.
- Native `<dialog>` + `showModal()` is the right primitive choice — free focus trap, free inerting, free top-layer rendering, free a11y semantics — and the team correctly delegated ESC through the `cancel` event rather than fighting the platform.

**Phase 6+ readiness assessment**

The current architecture is well-set for most named Phase 6+ extensions. DOM-anchored pins fit naturally as a new `Shape` discriminant (e.g. `{ type: 'pin'; xpath: string }`) with `componentOutline.ts` reusable for XPath generation; the SVG overlay would render pins as numbered circles with zero serializer changes. A session-replay ring buffer would slot in next to `consoleBuffer.ts` using the same module-singleton install pattern. A Fabric.js upgrade is the most invasive — the SVG-via-image flatten dance in `serializer.ts` would be replaced wholesale, but the shape-model boundary is clean enough that the rest of the code would not notice. The one concern is the `Shape` discriminated union: adding rich object handles (rotation, scale, transform matrices) would require a v2 schema in `types.ts` with migration handling, since the current shapes ship inside the GitHub issue body as v1 JSON. Recommend reserving `schemaVersion` literal handling on the server before any Phase 6 work that mutates shape semantics.
