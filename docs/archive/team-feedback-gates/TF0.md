# Phase TF0 Gate — Foundation (projects + cluster + CASL + MSW)

**Spec:** `airavata-custos/docs/portal/2026-05-22-nexus-portal-team-feedback-v1.md` §9 phase TF0.
**Baseline commit:** `a4c76c0 Add Phase A5+A6 gate report closing analytics goal`.
**HEAD commit:** `caca3c8 Add TF0 unit tests for projects and clusters`.

## Commits in TF0

```
25ed887 Add EnableToggle primitive with confirmation flow
65979a8 Extend projects feature module with list and usage-summary fetchers
7fb9f2b Add cluster status management to admin feature module
2aa5fc9 Add Project and Cluster CASL subjects
95ac517 Add MSW handlers and seed for projects list and cluster status
caca3c8 Add TF0 unit tests for projects and clusters
```

## New primitives shipped (spec §7)

### `EnableToggle` — `src/shared/ui/EnableToggle.tsx`

Confirm-flow admin toggle for `{kind: 'cluster' | 'resource'}` resources.
Renders a pill-styled trigger (brand-tint bg + green dot when ENABLED, muted
bg + gray dot when DISABLED — never red). Click opens the existing `Dialog`
with the impact summary (`activeAllocations`, `activeUsers`, optional
`inflightJobs`). Confirm runs the async `onConfirm` callback; spinner shows
mid-flight; success toast via `sonner`; failure renders inline `ErrorState`
inside the dialog body. `disabled` prop renders the switch non-interactive
with a "(read-only)" aria-label suffix so non-admins still see the current
state with screen-reader context. 6 unit tests:

1. Enabled rendering (green dot, aria-checked=true).
2. Disabled rendering (gray dot, aria-checked=false).
3. Click opens dialog with impact numbers.
4. Confirm fires `onConfirm(next)` with the toggled value.
5. Rejected `onConfirm` renders `ErrorState` in-dialog.
6. `disabled` prop blocks clicks and announces read-only.

### `GroupByChipGroup` — already shipped

Verified in `src/shared/ui/GroupByChip.tsx` (lines 67–83) from A0 — uses the
children-container pattern that three analytics consumers already use
(`AdminAnalytics.tsx`, `PiAnalytics.tsx`, `ResearcherAnalytics.tsx`). Per
spec §7.2 "If present, skip" — no changes; the spec's chips-array shape
would be a regression on existing call sites and add no functional surface.
TF3's `/analytics/resources` tab will reuse the existing primitive the same
way A1–A3 did.

## Feature module extensions

### `features/projects/` (spec §5.2)

- `schemas.ts` — added `projectListEnvelopeSchema` (paginated `{items,total}`
  envelope), `projectUsageSummarySchema` (+ `allocations` / `by_resource` /
  `by_member` row schemas), `createProjectPayloadSchema`,
  `updateProjectStatusPayloadSchema`.
- `api.ts` — added `listProjects(params)` (paged, sends `paged=1` so the
  same `/projects` route can disambiguate vs the legacy autocomplete),
  `getProjectsForUser(userId)`, `getProjectUsageSummary(id, range)`,
  `createProject(payload)`, `updateProjectStatus(id, payload)`. Kept all
  prior fetchers (`getProject`, `searchProjects`, `getProjectsAsPi`,
  `getProjectComputeAllocations`).
- `queries.ts` — extended `projectKeys` with `list`, `forUser`,
  `usageSummary`; added `useProjects(params)`, `useProjectsForUser(userId)`,
  `useProjectUsageSummary(id, range)`, `useCreateProject`,
  `useUpdateProject`. CASL gating lives at call sites — hooks themselves
  are role-agnostic.
- `components/` (new dir) — stubs for `ProjectsList`,
  `ProjectDetailHeader`, `ProjectAllocationsTable`,
  `MostUsedResourceCallout`. Each exports a typed prop interface + a
  null-returning placeholder so TF1/TF3 containers can import stable paths
  without speculation about the rendered shape.

### `features/admin/` cluster sub-feature (spec §5.3)

- `schemas.ts` — added `clusterStatusSchema` (`ENABLED|DISABLED`),
  `clusterSchema` (admin-facing row: `{id, name, status, type?,
  location?, allocation_count, user_count, inflight_jobs?}`),
  `updateClusterStatusPayloadSchema`.
- `api.ts` — added `listClusters({status?})`, `updateClusterStatus(id,
  status)` (PATCH `/compute-clusters/{id}` with the Zod-validated body).
- `queries.ts` — added `clusterKeys` factory, `useClusters(params)`,
  `useEnabledClusters()` wrapper (single canonical source for selector
  consumers per spec §5.4), `useUpdateClusterStatus` mutation that
  invalidates the full `clusterKeys.all` tree on success so every variant
  (enabled-only, all-statuses) refetches.

### `features/allocations/schemas.ts`

- `computeClusterSchema` gains an optional `status: 'ENABLED' | 'DISABLED'`
  field. Optional on the shared schema so existing selector consumers
  reading `{id, name}` aren't forced to update; the admin row narrows it
  to required.

## CASL additions

`src/shared/casl/abilities.ts`:

- New `AbilityContext` field: `myMemberProjects: string[]` — membership-
  derived project IDs (includes PI-owned projects since PIs are members of
  their own allocations).
- Researcher/PI/co_PI/allocation_manager block: `can('read', 'Project', {
  id: { $in: ctx.myMemberProjects } })` + `can('read', 'Cluster')`.
- PI/co_PI block: `can('create', 'Project')` + `can('manage', 'Project',
  { id: { $in: ctx.myPiProjects } })`.
- Admin block: `can('manage', 'Project')` + `can('create', 'Project')` +
  `can('manage', 'Cluster')` — kept explicit so all admin grants are
  greppable in one place even though `manage all` already covers them.

Propagation through the auth pipeline:

- `src/shared/auth/personaScopes.ts` — `derivePersonaScopes` now computes
  `myMemberProjects` by walking user → memberships → allocations → project
  ids.
- `src/shared/auth/auth.ts` — Credentials provider, OIDC fallback, JWT
  callback, and session callback all round-trip `myMemberProjects`.
- `src/types/next-auth.d.ts` — `Session.user`, `User`, and `JWT` all gain
  `myMemberProjects?: string[]`.
- `src/shared/casl/AbilityProvider.tsx` — feeds the new context field into
  `defineAbilityForRole`.
- `src/mocks/handlers/users.ts` — `/me/scopes` includes the new field for
  the OIDC scopes-fallback path.

5 new tests in `src/shared/casl/__tests__/abilities.test.ts`:

1. Researcher reads only member projects, cannot create.
2. PI reads own + member projects, creates, manages only own
   (myPiProjects).
3. Admin manages all projects + clusters.
4. Researcher cannot manage Cluster (toggle stays read-only).
5. PI cannot manage Cluster (admin-only per spec).

Total CASL test suite: 18/18 passing.

## MSW endpoints + seed changes

### New handler files

`src/mocks/handlers/projects.ts`:

- `GET /projects?paged=1&limit&offset&pi_id&status&q` — paged
  `{items,total}` envelope; falls through to legacy autocomplete behavior
  when `paged` is absent (returns bare array, requires `q`). Both modes
  use Zod-validated query params.
- `POST /projects` — Zod-validated body (`createProjectPayloadSchema`);
  appends to seed + persists.
- `GET /projects/{id}` — moved from `users.ts`.
- `PUT /projects/{id}/status` — mutates seed status with body validation.
- `GET /projects/{id}/compute-allocations` — moved from `users.ts`.
- `GET /projects/{id}/usage-summary?from&to` — mock-only aggregator over
  `seed.usages` returning the §8 B8 shape (allocations, by_resource,
  by_member). Validates the payload through `projectUsageSummarySchema`
  before returning.
- `GET /users/{id}/projects-as-pi` — moved from `users.ts`.
- `GET /users/{id}/projects` (NEW, spec §8 B2) — member-derived via
  `getProjectsForUserSeed` helper.

`src/mocks/handlers/clusters.ts`:

- `GET /compute-clusters?status=` — admin row shape derived from
  `seed.clusters`. `allocation_count`/`user_count` computed fresh per
  request so disabling doesn't hide existing allocations from the count.
- `PATCH /compute-clusters/{id}` body `{ status }` — Zod-validated;
  mutates `seed.clusters[i].status` + persists; returns the updated row.

### `src/mocks/handlers/index.ts`

- Imports + registers `projectHandlers` (before `userHandlers` so the new
  `/projects` route wins over any future overlap) and `clusterHandlers`
  (after `adminHandlers`).

### Seed (`src/mocks/seed/index.ts`)

- Cluster array gains explicit `status`: `cluster-001` ENABLED, `cluster-
  002` ENABLED, plus a new `cluster-003` `Nexus-Legacy` DISABLED for QA
  visibility out of the box.
- New `getProjectsForUserSeed(userId)` helper exports the membership-
  derived project list used by `/users/{id}/projects`.

## Unit tests

- `src/shared/ui/__tests__/EnableToggle.test.tsx` — 6 tests (above).
- `src/features/projects/__tests__/api.test.ts` — 11 tests covering
  envelope schema, payload schemas, paged list URL serialization, member-
  scope fetcher, create/update mutators, usage-summary range serialization
  + schema round-trip.
- `src/features/admin/__tests__/clusters.test.ts` — 10 tests covering
  cluster schema validation, status payload schema, list filter wiring,
  PATCH body + URL encoding, backend-drift rejection.
- 5 new CASL tests in `src/shared/casl/__tests__/abilities.test.ts`.

Full suite: **44 test files, 308 tests, all green.**

## DoD criteria — TF0

- [x] `EnableToggle` primitive renders + tested (6 tests).
- [x] `GroupByChipGroup` verified present (A0 carry-over); no churn.
- [x] `features/projects/` extended (api + queries + schemas + component
      stubs).
- [x] `features/admin/` cluster sub-feature added (api + queries +
      schemas + `useEnabledClusters` hook).
- [x] CASL `Project` + `Cluster` subjects added with persona scoping +
      tests.
- [x] MSW handlers for B1, B2, B3, B5, B6 ship with Zod-validated
      requests and responses.
- [x] Seed marks 1 cluster DISABLED for QA visibility.
- [x] `pnpm verify` green: lint clean, typecheck clean, 308/308 tests,
      build clean.
- [x] `pnpm test:e2e --workers=1` green: 68/68.
- [x] Cross-feature isolation greps: one pre-existing same-feature import
      (`AllocationDetailHeader.tsx → @features/allocations/schemas`) is
      documented in S3 + A0 gates as allowed; no new violations.
- [x] Hardcoded brand-utility greps zero (grep
      `\b(text|bg|border)-nexus-(blue|red|green|amber|gray)-[0-9]+\b` →
      0).
- [x] No new `/projects` or `/admin/resources` page surfaces built (those
      land in TF1 + TF2 per spec §9).

## Verification commands & output

```bash
pnpm verify   # lint + tsc + vitest (308/308) + next build → clean
pnpm test:e2e --workers=1   # 68/68 passed in 3.9 minutes
grep -rn "from ['\"]@features/" src/features/   # 1 pre-existing (S3-allowed)
grep -rn "from ['\"]@features/" src/shared/     # 0
grep -rnE "from ['\"](@features|@shared)/" src/lib/   # 0
grep -rn "from ['\"]\\.\\./[^'\"]*features/" src/features/   # 0
grep -rnE "\b(text|bg|border)-nexus-(blue|red|green|amber|gray)-[0-9]+\b" src/   # 0
```

## Open items / deferrals for TF1

- **No `/projects` route yet.** TF1 will land `src/app/(portal)/projects/
  page.tsx` + `[id]/page.tsx` consuming the queries shipped here.
  Component files are stubs; TF1 will replace each `null` return with
  real presentational code.
- **`MostUsedResourceCallout` shared across three surfaces.** TF3 builds
  the actual presentation once and re-mounts it on allocation detail,
  project detail Resource Usage tab, and `/analytics/resources`. The stub
  exists in `features/projects/components/` per spec §5.2; TF3 may
  promote it to `src/shared/ui/` if the visual is identical at all three
  call sites.
- **No `/admin/resources` Clusters tab yet.** TF2 lands the
  `ClustersTable` + the selector-filter migration to `useEnabledClusters`
  across proposal wizard, allocation creation form, SSH cert allocation
  picker.
- **Mock-only aggregation `getProjectUsageSummary` shape.** The MSW
  implementation computes resource `used_pct` as share-of-project-total
  (not share-of-resource-allocated) because resource-level allocated SUs
  aren't modeled in seed. TF1 contract doc (`docs/backend-contracts/
  projects.md`) will spell this out explicitly so the real backend
  implements either interpretation consistently.
- **`POST /projects` mock returns ACTIVE by default.** The real backend
  may have a DRAFT/SUBMITTED flow; current spec doesn't address project
  lifecycle. TF1 will surface the question if PI usage exposes the gap.
- **`useEnabledClusters` is shipped but not yet consumed by selectors.**
  TF2 migrates proposal wizard, allocation creation form, and SSH cert
  allocation picker to consume it; until then the existing
  `seed.clusters` selectors will silently include `cluster-003` DISABLED.
  Acceptable for TF0 (no new selectors regressed).

## Sign-off

- QA visual review: _pending_
- Architect review: _pending_

## Architect-review (PASS-WITH-NOTES)

All 12 verification items pass. EnableToggle ships per spec §7.1 with 6 tests. GroupByChipGroup already shipped in A0 (correctly skipped). Projects feature module extended (5 fetchers + 5 hooks + schemas + 4 component stubs). Admin cluster sub-feature with `useEnabledClusters()` single-source helper. CASL `Project` + `Cluster` subjects with `myMemberProjects` propagated through full auth pipeline (personaScopes → auth.ts Credentials+OIDC+JWT+session → next-auth.d.ts → AbilityProvider → /me/scopes MSW). MSW handlers Zod-validate both directions. Seed has 1 DISABLED cluster for QA visibility.

### LOW (TF1/TF2/TF3 housekeeping)
1. **TF1:** Trim redundant `projectKeys.detail` invalidation in `useUpdateProject` (`projectKeys.all` already covers as prefix).
2. **TF1:** Lock the `/projects?paged=1` two-mode contract in `docs/backend-contracts/projects.md` — discriminator currently only in handler code.
3. **TF1:** `getProjectUsageSummary` computes `used_pct` as share-of-project-total because resource-level allocated SUs aren't in seed; commit to one interpretation in contract doc.
4. **TF1:** Decide project lifecycle (ACTIVE-on-create vs DRAFT/SUBMITTED). MSW handler hardcodes ACTIVE today.
5. **TF2 (architectural):** `useEnabledClusters` will be consumed by `features/proposals`, `features/allocations`, `features/signer` — importing from `@features/admin/queries` would break the §5 isolation grep. **Promote `clusterKeys` + `useEnabledClusters` to `features/allocations/queries.ts`** since clusters are an allocations-domain concept. Document in TF2 plan.
6. **TF3:** `MostUsedResourceCallout` stub lives in `features/projects/components/` but will be used by allocation detail + project Resource Usage tab + `/analytics/resources`. **Promote to `src/shared/ui/`** in TF3 if visual is identical across all three sites — otherwise allocations/analytics import from projects feature module breaks isolation.

### Strengths
- `EnableToggle` brand-tint/green-dot enabled vs muted/gray disabled — never red. Right semantic.
- `myMemberProjects` PI-as-member union keeps `read Project` rule degenerate to "any project I touch" without union logic at call sites. Clean.
- Schema dual-shape (lean `computeClusterSchema` for selectors, richer admin `clusterSchema` for the admin table) avoids forcing existing selectors to update.
- MSW handler order in `index.ts` correct (projects before users, clusters after admin).
- 308 unit tests / 25 routes / build clean. TypeScript no `any` / `@ts-ignore`.

Sign-off: APPROVED. TF1 may proceed with the 4 housekeeping items as carry-overs.
