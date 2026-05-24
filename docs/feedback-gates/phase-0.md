# Feedback Mode — Phase 0 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-23-nexus-portal-feedback-mode.md`
**Phase:** 0 — Foundation (deps + env + scaffolding)
**Date:** 2026-05-23

## Deliverables shipped

| Deliverable | Path | Status |
|---|---|---|
| Add `html2canvas-pro` dep | `package.json`, `pnpm-lock.yaml` | done — `html2canvas-pro@2.0.3` |
| Env schema: `FEEDBACK_GITHUB_TOKEN` / `FEEDBACK_GITHUB_REPO` / `FEEDBACK_LABEL` / `NEXT_PUBLIC_BUILD_SHA` | `src/lib/env.ts` | done |
| Build SHA wired from git rev-parse | `next.config.ts` | done |
| Commented `.env` placeholders for the three FEEDBACK_* vars | `scripts/provision-vm.sh` | done |
| Type model (`Shape`, `FeedbackPayload`, etc. with zod schemas) | `src/features/feedback/types.ts` | done |
| Route handler stub returning 501 | `src/app/api/feedback/route.ts` | done |

## Design change vs. spec (committed back to spec)

The spec originally required schema-level fail-fast when `NODE_ENV === 'production'` and `FEEDBACK_GITHUB_TOKEN` was unset. **Removed** — `next build` sets `NODE_ENV=production` during page-data collection, so a schema-level prod gate blocked the build for any deploy where the token isn't ready yet. The existing OIDC fail-fast sidesteps this by gating on `PORTAL_AUTH_MODE` (an opt-in), not `NODE_ENV`.

Enforcement moves to the POST handler in Phase 3: missing-token in production returns 503 with a clear error and a server-side log. Spec DoD item 2 + Phase 0 gate text updated to match.

## Gate evidence

```text
$ pnpm typecheck
> tsc --noEmit
(no output, exit 0)

$ pnpm lint
> biome lint .
Checked 406 files in 50ms. No fixes applied.

$ pnpm build
✓ Compiled successfully in 5.4s
Route (app)                                 Size  First Load JS
├ ƒ /api/feedback                          157 B         103 kB
... (no regressions; first-load JS for /projects, /home, /allocations unchanged)
```

`/api/feedback` shows up in the route manifest as a dynamic route. Bundle delta on existing routes: 0 (the feedback chunk hasn't been imported yet — it'll appear in Phase 1 once `FeedbackPanel` is wired via `next/dynamic`).

## Carry-overs to Phase 1

None blocking. Note that:
- `NEXT_PUBLIC_BUILD_SHA` is now available app-wide via `clientEnv.NEXT_PUBLIC_BUILD_SHA` — Phase 4 context-capture will read it.
- The 501 route stub will be replaced wholesale in Phase 3 with the real auth + zod + GH handler.

## Files touched

```
M next.config.ts
M package.json
M pnpm-lock.yaml
M scripts/provision-vm.sh
M src/lib/env.ts
A src/features/feedback/types.ts
A src/app/api/feedback/route.ts
A docs/feedback-gates/phase-0.md   (this file)
```

Status: **gate passed**. Phase 1 unblocked.
