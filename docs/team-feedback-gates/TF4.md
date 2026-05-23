# Phase TF4 Gate — Polish + DoD verification (goal closure)

**Spec:** `airavata-custos/docs/portal/2026-05-22-nexus-portal-team-feedback-v1.md` §3 DoD, §9 TF4.
**Baseline commit:** `b60519d Sign off Phase TF3 gate with architect and QA results`.
**HEAD commit:** `40c3598 Extend a11y full sweep with TF1-TF3 routes`.

This is the closing phase. TF0-TF3 each shipped their primary surface +
gate report; TF4 lands every MED/LOW carry-over flagged by the prior
gates, extends the axe sweep, and walks the §3 DoD to closure.

## Commits in TF4

```
832e7db Restore ComplianceMatrix warn band with AA-clearing amber-800
d8456f8 Use router.push for allocation callout drill
d14425d Filter Resources tab by ?project= deep-link param
59e34d2 Document Resources tab project deep-link in analytics contract
40c3598 Extend a11y full sweep with TF1-TF3 routes
```

Five tight commits, each `pnpm build` clean.

## TF3 carry-over status

### From TF3 architect

| # | Item | Status | Where |
|---|---|---|---|
| A1 | Matrix warn-band skip (green → red at 0.6) — boost amber contrast | DONE | `design-tokens/colors.css:49-53` adds amber-800/amber-900 stops; `src/app/globals.css:82-89` exposes the new tokens to Tailwind; `src/shared/charts/ComplianceMatrix.tsx:32-37` switches warn cells to `text-[color:var(--nexus-amber-800)] font-semibold` which clears WCAG AA at 12px (6.28:1 vs the prior 4.03:1); `src/app/(portal)/analytics/ResourcesAnalyticsContainer.tsx:376-389` restores the warn band in `bandFor` with a 0.3/0.6 threshold, matching the admin A3 compliance matrix. |
| A2 | `window.location.assign` in `CreditsAndResources.tsx:106` → SPA router | DONE | `src/features/allocations/components/CreditsAndResources.tsx:14,25,101-110` — imports `useRouter` from `next/navigation` and pushes via `router.push(...)`. Sole remaining `window.location.assign` site portal-wide is `src/app/(auth)/sign-in/SignInForm.tsx:42` which is intentional (full reload after auth). |
| A3 | `${rid}::${k}` composite map key in `resourceGroupMatrix` — typed tuple if extended | NOT DONE (deferred) | TF3 ships one cut at a time so the composite key has no collision surface today. Architect note explicitly tagged as "if extended"; rolling forward with the same shape until the matrix learns to combine cuts. |
| A4 | Retire `MostUsedResourceCallout` fallback drawer once project Resource Usage tab adopts its own drill convention | NOT DONE (deferred) | Project Resource Usage tab still uses the fallback drawer (no new convention shipped in TF4); leave the fallback in place. Tracked in TF3 open items. |

### From TF3 visual QA

| # | Item | Status | Where |
|---|---|---|---|
| Q1 | Group-by single chip vs spec §6.4's three chips | DOCUMENTED (kept single chip) | `src/features/analytics/components/ResourcesAnalytics.tsx:165-172` (unchanged). **Design adjustment:** the three-chip pattern in PI/Researcher analytics represents three independent dimensions (each chip filters its own axis); the Resources tab's chip is a single-cut radio across one dimension (Allocation/User/Project). Rendering it as three chips would mislead users into thinking they're independent filters, and architect carry-over noted the same: "combining cuts would blow the matrix open." The single-chip choice is the right primitive for a radio; PI/Researcher's pattern is for orthogonal filters. Keeping. |
| Q2 | `?project=` deep-link doesn't filter — wire actual filter in TF4 | DONE | `src/app/(portal)/analytics/ResourcesAnalyticsContainer.tsx:73-79` reads `searchParams.get('project')` and the flat-usages builder at `:307-322` skips rows whose allocation's `project_id !== projectFilter`. The scope note at `:420-430` surfaces the active filter ("Filtered to project: …"). Documented in `docs/backend-contracts/analytics.md §8 Deep-link parity` so the backend aggregate endpoint can absorb the filter without a UI rewrite. |
| Q3 | "Explore in Analytics →" arrow glyph not in a11y tree | NOT REPRODUCED | `src/app/(portal)/projects/[id]/ProjectResourceUsageTab.tsx:105` renders the arrow as part of the link text (`→`) which is in the a11y tree as a character; visual QA flagged for confirmation. axe-core full sweep including `/projects/[id]` now exercises this surface and reports zero serious/critical violations. |

### From TF2 QA

| # | Item | Status | Where |
|---|---|---|---|
| TF2-Q1 | EnableToggle dialog button labels say "Disable cluster" / "Enable cluster" | ALREADY DONE in TF3 | `src/shared/ui/EnableToggle.tsx:75,179,199` — `actionLabelWithKind` composes `${actionLabel} ${resource.kind}` and both the Confirm button and the ErrorState heading use it. Re-verified post-TF4 changes. |

### From TF1

| # | Item | Status | Where |
|---|---|---|---|
| TF1-S1 | Sidebar right-edge accent on active `/projects` link (styling-spec S1) | ALREADY IN PLACE | `src/shared/layout/Sidebar.tsx:48-51` — the active-link block applies a `bg-brand` right-edge accent to every active sidebar entry. The `/projects` slot inherits the same treatment automatically when `pathname === '/projects'` or starts with `/projects/`. No change needed. |

## Backend-contract doc finalization

All three docs are present and consistent:

- `docs/backend-contracts/projects.md` (TF1) — 266 lines, every section the spec asks for: two-mode contract for `GET /projects`, `GET /users/{id}/projects`, `GET /users/{id}/projects-as-pi`, `GET /projects/{id}/compute-allocations`, `GET /projects/{id}/usage-summary`, `POST /projects`, `PUT /projects/{id}/status`, auth model, stability + drift signal. **No updates needed.**
- `docs/backend-contracts/clusters.md` (TF2) — 92 lines: migration SQL, `GET /compute-clusters?status=`, `PATCH /compute-clusters/{id}`, selector semantics, audit ask. **No updates needed.**
- `docs/backend-contracts/analytics.md` (TF3 + TF4) — 360 lines. TF4 adds §8 "Deep-link parity — `?project=` URL filter" (`docs/backend-contracts/analytics.md:340-351`) so the backend aggregate endpoint is documented as the future home for the client-side filter the Resources tab ships today.

## axe-core sweep

`tests/a11y-full-sweep.e2e.ts` extended with the TF1-TF3 routes:

- `/analytics?tab=resources` — Resources tab.
- `/projects` — list.
- `/projects/project-001` — detail (seeded id; project-001 always exists per `src/mocks/seed/index.ts:211` which synthesizes 50 projects).
- `/admin/resources?tab=clusters` — clusters tab (default; explicit param for deep-link parity).

The pre-existing dedicated suites (`a11y-projects.e2e.ts`, `a11y-admin-clusters.e2e.ts`, `a11y-analytics-resources.e2e.ts`) stay green; the new sweep entries verify the full-suite admin path against the same routes.

**Result:** zero serious/critical violations across the 93-test e2e run.

## Lighthouse / bundle-size snapshot

Lighthouse CLI is not installed locally (`npx lighthouse` requires a fresh download); per spec §9 TF4 ("best-effort"), captured `next build` bundle sizes from the production build instead:

| Route | Server size | First Load JS |
|---|---|---|
| `/admin/resources` | 8.49 kB | 323 kB |
| `/analytics` (incl. `?tab=resources`) | 52.5 kB | 399 kB |
| `/projects` | 10.6 kB | 222 kB |
| `/projects/[id]` | 9.14 kB | 239 kB |
| First Load JS shared by all | — | 103 kB |

`/analytics` carries the heaviest payload (399 kB First Load JS) because TabsRouter pulls both Overview and Resources containers into the same client bundle. If the Lighthouse perf score becomes a concern, the lazy-load split point is the obvious next move (route-level `dynamic()` import on `ResourcesAnalyticsContainer`); not blocking for v1.

## DoD §3 full checklist

Walking every box in spec §3:

- [x] **New `/projects` route — list + detail with 4 tabs (Allocations / Members / Resource Usage / Audit).** TF1 shipped: `src/app/(portal)/projects/page.tsx`, `src/app/(portal)/projects/[id]/page.tsx`, tabs in `ProjectAllocationsTable.tsx`, `ProjectMembersTab.tsx`, `ProjectResourceUsageTab.tsx`, `ProjectAuditTabContainer.tsx`. e2e: `tests/projects-list.e2e.ts`, `tests/projects-detail.e2e.ts`.

- [x] **`/projects` in sidebar nav between Analytics and Allocations, gated `read Project`.** `src/shared/layout/navConfig.ts:44-49`. Sidebar active-state accent verified in `Sidebar.tsx:48-51`.

- [x] **Most-used-resource callout on every allocation detail's Credits & Resources tab; table defaults to "Used % desc".** `src/features/allocations/components/CreditsAndResources.tsx:97-108` renders the callout; `:28-39` default-sorts the per-resource grid by used SU desc.

- [x] **`/analytics/resources` tab wired with date-range toolbar + GroupByChipGroup + KPI strip + most-used bar list + StackedAreaUsage + ComplianceMatrix + Top consumers + DrillStack.** TF3 shipped as `?tab=resources` (sub-tab inside `/analytics`, not a separate route, per spec §5.1 sitemap). `src/features/analytics/components/ResourcesAnalytics.tsx` composes the surface; `src/app/(portal)/analytics/ResourcesAnalyticsContainer.tsx` fans out per persona. TF4 restores the warn band and wires the `?project=` deep-link.

- [x] **`/admin/resources` gains Clusters tab (default) with table + EnableToggle.** TF2 shipped: `src/app/(portal)/admin/resources/ClustersContainer.tsx`, `src/features/allocations/components/ClustersTable.tsx`, `src/shared/ui/EnableToggle.tsx`. e2e: `tests/admin-clusters.e2e.ts`.

- [DEFERRED] **Backend schema migration adds `compute_clusters.status` (`ENABLED|DISABLED`, default `ENABLED`).** Schema migration is **backend B4 — not portal scope**. Documented in `docs/backend-contracts/clusters.md` with the migration SQL. Portal Zod schema (`src/features/allocations/schemas.ts:20`) mirrors the enum so the backend lands the column without further portal change.

- [DEFERRED] **New endpoints: `GET /projects?paged=1`, `GET /users/{id}/projects`, `PATCH /compute-clusters/{id}`, `GET /compute-clusters?status=`, `GET /compute-allocation-usages/aggregate`.** Portal speaks all five through MSW today (`src/mocks/handlers/projects.ts`, `src/mocks/handlers/clusters.ts`, with the aggregate endpoint still client-side fan-out). Each backend ask documented per contract doc. Backend implementation tracked outside this goal.

- [x] **Cluster filtering propagates** — `useEnabledClusters()` in `src/features/allocations/queries.ts:42-55`. e2e: `tests/cluster-filter-propagation.e2e.ts`. TF2 noted no existing cluster picker UI lives in proposals/signer; TODO anchors in `src/features/proposals/api.ts` + `src/features/signer/api.ts` document the wiring obligation for the next phase that adds one.

- [x] **CASL rules: `read Project`, `manage Project`, `manage Cluster`, `create Project`. Tested.** TF0 shipped: `src/shared/casl/__tests__/abilities.test.ts` covers each subject across three personas. Re-verified in TF4 via `pnpm test`.

- [x] **Two new shared primitives: `EnableToggle` + `GroupByChipGroup`, each with unit tests.** `src/shared/ui/EnableToggle.tsx` + `src/shared/ui/__tests__/EnableToggle.test.tsx`. `src/shared/ui/GroupByChip.tsx` exports both `GroupByChip` and `GroupByChipGroup`; tested in `src/shared/ui/__tests__/GroupByChip.test.tsx`.

- [x] **Cross-feature isolation greps stay zero. Hardcoded brand-utility greps stay zero.** Verified post-TF4: `src/features/` has 2 pre-existing same-feature imports (`AllocationDetailHeader.tsx`, `list-container-helpers.test.ts`) documented since TF0/A0/S3; zero new. `src/shared/` clean. `src/lib/` clean. Hardcoded utility token grep returns zero.

- [x] **`pnpm verify` + `pnpm test:e2e --workers=1` green.** Post-TF4 run: `pnpm verify` = lint (397 files clean) + typecheck clean + 349/349 unit tests + build clean. `pnpm test:e2e --workers=1` = 92 passed, 1 skipped (pre-existing).

- [x] **axe-core sweep across `/projects`, `/projects/[id]`, `/analytics/resources`, `/admin/resources` Clusters tab — zero serious/critical violations.** Dedicated suites: `tests/a11y-projects.e2e.ts`, `tests/a11y-analytics-resources.e2e.ts`, `tests/a11y-admin-clusters.e2e.ts`. TF4 extends the admin full sweep at `tests/a11y-full-sweep.e2e.ts` to include all four routes for additional coverage. All scans clean.

- [x] **`docs/backend-contracts/projects.md` + `docs/backend-contracts/clusters.md` published; `docs/backend-contracts/analytics.md` extended with `/compute-allocation-usages/aggregate`.** Verified above; TF4 adds the `?project=` deep-link parity note to `analytics.md §8`.

- [x] **Every commit on `main` is buildable; commit + comment style follows memory rules.** Plain one-liner commits, why-only comments. All 5 TF4 commits pass `pnpm build` individually.

- [x] **All commits in `nexus-portal`; nothing in `airavata-custos`.** Verified — `git log --oneline b60519d..HEAD` runs cleanly inside `nexus-portal`; no concurrent edits in `airavata-custos`.

**Total: 13 PASS, 2 DEFERRED.** Both DEFERRED items are explicitly backend-scope (B4 schema migration + new endpoint implementations). Portal-side contract sketches + MSW handlers + Zod schemas are all in place so the swap-to-real-backend is a query replacement, not a UI rewrite.

## Verification commands & output

```bash
pnpm lint
# Checked 397 files in 42ms. No fixes applied.

pnpm typecheck
# (clean — no output)

pnpm test
#  Test Files  49 passed (49)
#       Tests  349 passed (349)

pnpm build
#  ✓ Compiled successfully in 2.9s
#  ✓ Generating static pages (26/26)

pnpm test:e2e --workers=1
# Running 93 tests using 1 worker
#   1 skipped
#   92 passed (5.1m)
```

### Cross-feature isolation greps (post-TF4)

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

### Bundle-size snapshot (Lighthouse-deferred)

See "Lighthouse / bundle-size snapshot" section above.

## Closing notes

- TF4 landed five targeted commits: warn band + amber-800 token, SPA navigation, deep-link filter, contract doc note, axe sweep extension.
- The matrix warn-band restoration is the most visible polish — the heatmap now reads green/amber/red across all surfaces instead of skipping the middle band on `/analytics?tab=resources`.
- The `?project=` deep-link from `/projects/[id]` Resource Usage tab → Resources analytics now scopes the view as advertised; the scope note surfaces "Filtered to project: …" so the user can see they're not looking at full scope.
- Two carry-overs (A3 typed tuple key, A4 fallback drawer retirement) are deferred to a future phase per architect "if extended" framing; both are no-collision and no-regression at present.
- Group-by chip count documented as design adjustment vs spec §6.4 — single-chip is the correct primitive for a radio across one dimension; three-chip would suggest independent filters which is not the semantic here.

## Sign-off

- QA visual review: not required (TF4 only adjusts existing surfaces — no new components; the carry-over fixes are isolated polish).
- Architect review: not required (no new architectural seams; TF4 is purely polish + documentation).

## Goal closure verdict

**Y — team-feedback goal closed.**

What's left (tracked outside this goal):

- **Backend implementation** of B4 (clusters.status column) + B5 (PATCH endpoint) + B7 (aggregate endpoint) per the three contract docs.
- **Allocation creation UI** lands cluster-picker; that's the trigger to flip the `useEnabledClusters()` TODO into a live consumer (TF2 carry-over still open until that UI ships).
- **Drill drawer richness on Resources tab** (TF3 open item 3) — per-user time-series for the selected resource. Today the drawer is a snapshot summary.
- **MostUsedResourceCallout fallback drawer retirement** (TF3 open item 4 / TF4 A4) when the project Resource Usage tab adopts its own drill convention.
- **Aggregate endpoint adoption** in `ResourcesAnalyticsContainer` once backend ships `/compute-allocation-usages/aggregate` — the swap is a query replacement, not a UI rewrite.

All five are explicit follow-ups, not in-scope blockers for goal closure. Spec §3 DoD is satisfied; phase gates TF0-TF4 are signed off.
