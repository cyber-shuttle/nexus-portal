# Phase TF1 Gate — `/projects` list + detail

**Spec:** `airavata-custos/docs/portal/2026-05-22-nexus-portal-team-feedback-v1.md` §9 phase TF1.
**Baseline commit:** `2b4a550 Sign off Phase TF0 gate with architect results`.
**HEAD commit:** `8bc0b0e Add e2e and a11y coverage for projects routes`.

## Commits in TF1

```
7455f0d Trim redundant project detail invalidation
2dade72 Document projects backend contract
437d8f2 Build projects feature presentational components
910ed21 Add /projects list and detail routes with sidebar slot
45fc2f4 Add unit tests for projects helpers and resource callout
8bc0b0e Add e2e and a11y coverage for projects routes
```

## TF0 carry-over status

| # | Item | Status | File:line |
|---|---|---|---|
| 1 | Trim redundant `projectKeys.detail` invalidation in `useUpdateProject` | DONE | `src/features/projects/queries.ts:115` |
| 2 | Lock the `/projects?paged=1` two-mode contract in `docs/backend-contracts/projects.md` | DONE | `docs/backend-contracts/projects.md` §1a + §1b |
| 3 | Document `used_pct` = share-of-project-total interpretation; ask backend for share-of-resource-allocated when allocated SUs exist | DONE | `docs/backend-contracts/projects.md` §5 |
| 4 | Decide project lifecycle (ACTIVE-on-create vs DRAFT/SUBMITTED); note MSW hardcodes ACTIVE | DONE | `docs/backend-contracts/projects.md` §6 |

## Pages shipped

### `/projects` — list (spec §6.1)

- Route: `src/app/(portal)/projects/page.tsx` (server component; reads session, derives persona, calls container).
- Container: `src/app/(portal)/projects/ProjectsListContainer.tsx` (persona-aware data composition).
- Presentational: `src/features/projects/components/ProjectsList.tsx` (DataTable + filter strip + EmptyState).
- Helpers: `src/features/projects/list-helpers.ts` (dedupe + rollup + persona empty copy).
- Loading: `src/app/(portal)/projects/loading.tsx`.

Persona scopes:

- **admin** → `useProjects({ limit: 50 })` paged list.
- **PI / co_pi / allocation_manager** → union of `useProjectsAsPi(userId)` + `useProjectsForUser(userId)`, deduped by id; PI rows tagged with a "PI" badge.
- **researcher / user** → `useProjectsForUser(userId)` (member-derived only).

Per-row rollup KPIs:

- Total SUs (sum of allocation `initial_su_amount`).
- Used % (sum of `getAllocationUsageTotal` divided by total).
- Allocations count.

Fan-out is capped at 50 rows per page; documented in `docs/backend-contracts/projects.md` §5. URL state: `?status=`, `?pi=`, `?q=` are round-tripped via `useSearchParams` + `router.replace`. Default sort: Used % desc, alpha tiebreak.

### `/projects/[id]` — detail (spec §6.2)

- Route: `src/app/(portal)/projects/[id]/page.tsx` (server component).
- Layout: `src/app/(portal)/projects/[id]/layout.tsx` (breadcrumb `Projects / {id}`).
- Container: `src/app/(portal)/projects/[id]/ProjectDetailContainer.tsx` (CASL-gated; fans out allocations + usage + change-requests).
- Tabs:
  - **Allocations** (default) — `src/features/projects/components/ProjectAllocationsTable.tsx`. Row links to `/allocations/{id}`. "Type" column placeholder (`Compute`) — Data deferred per spec non-goals.
  - **Members** — `src/app/(portal)/projects/[id]/ProjectMembersTab.tsx`. Distinct user-set across every allocation; PI surfaced with brand-tint pill.
  - **Resource Usage** — `src/app/(portal)/projects/[id]/ProjectResourceUsageTab.tsx`. `MostUsedResourceCallout` + sorted resource table + "Explore in Analytics →" link to `/analytics/resources?project={id}`.
  - **Audit** — `src/app/(portal)/projects/[id]/ProjectAuditTabContainer.tsx`. Merged timeline across every project allocation; reuses `AuditTab` presentational from `@features/audit`.

KPI strip (`StatCardRow cols={4}`): Total Allocated · Used (all) · Members · Pending CRs (clickable when > 0 → `/change-requests?project={id}`).

Header (`ProjectDetailHeader`): H1 + MetaRow (status pill + PI + Origination + Created) + `+ Add allocation` CTA gated `can('create', 'Allocation', { projectId })` and disabled with tooltip "Allocation creation lands in a future phase".

### Sidebar nav (spec §5.1)

`src/shared/layout/navConfig.ts` — `/projects` inserted in slot 3 between Analytics and Allocations with `ability: { action: 'read', subject: 'Project' }` (every signed-in persona sees it; CASL scopes the rows).

### `MostUsedResourceCallout` MVP

`src/features/projects/components/MostUsedResourceCallout.tsx` — horizontal-bar list of top-N resources (rank, name, percent, mini-bar, raw SUs). Row click opens a placeholder `DrillStack` drawer; TF3 will wire per-user / per-allocation breakdown and promote the component to `src/shared/ui/` per TF0 architect note.

## DoD criteria — TF1

- [x] `/projects` route shipped (list + filter strip + persona-aware composition).
- [x] `/projects/[id]` detail shipped with 4 tabs (Allocations default, Members, Resource Usage, Audit).
- [x] Sidebar nav slot 3 added gated `read Project`.
- [x] `MostUsedResourceCallout` MVP renders in the Resource Usage tab; drill drawer placeholder works.
- [x] Persona scopes correct: admin paged-all, PI union + dedupe + PI badge, researcher member-only.
- [x] CASL gate `read Project` enforced on detail container (`subject('Project', { id })`); CTA `+ New project` gated `create Project`; `+ Add allocation` gated `create Allocation`.
- [x] URL state for filters (`?q`, `?pi`, `?status`) and tab (`?tab=members|resources|audit`) round-trips.
- [x] Default sort: Used % desc, alpha tiebreak — implemented in `ProjectsList.defaultSort`.
- [x] Fan-out capped at top-50 per page; cost documented in `docs/backend-contracts/projects.md` §5.
- [x] Unit tests:
  - `src/features/projects/__tests__/list-container-helpers.test.ts` — 12 tests (dedupe + rollup + empty copy).
  - `src/features/projects/components/__tests__/MostUsedResourceCallout.test.tsx` — 7 tests (sort, percent, topN default, tiebreak, empty state).
- [x] E2E tests:
  - `tests/projects-list.e2e.ts` — 5 tests (researcher / PI / admin scope; row click; status filter URL).
  - `tests/projects-detail.e2e.ts` — 3 tests (4 tabs switch; drill into allocation; breadcrumb).
  - `tests/a11y-projects.e2e.ts` — 1 sweep across list + detail + 4 tabs.
- [x] `pnpm verify` green: 326/326 unit tests + lint + typecheck + build clean.
- [x] `pnpm test:e2e --workers=1` green: 76/77 (1 pre-existing skip; net +9 vs TF0 baseline of 68).
- [x] Cross-feature isolation greps: 1 pre-existing same-feature import (`AllocationDetailHeader.tsx → @features/allocations/schemas`) is the documented S3/A0/TF0-allowed entry; zero new violations.
- [x] Hardcoded brand-utility greps zero.
- [x] All 6 commits on `main` are individually `pnpm build` clean.

## Verification commands & output

```bash
pnpm verify   # lint + tsc + vitest (326/326) + next build → clean
pnpm test:e2e --workers=1   # 76 passed, 1 skipped in 4.2m
grep -rn "from ['\"]@features/" src/features/   # 1 pre-existing (TF0/S3-allowed)
grep -rn "from ['\"]@features/" src/shared/     # 0
grep -rnE "from ['\"](@features|@shared)/" src/lib/   # 0
grep -rn "from ['\"]\\.\\./[^'\"]*features/" src/features/   # 0
grep -rnE "\b(text|bg|border)-nexus-(blue|red|green|amber|gray)-[0-9]+\b" src/   # 0
```

## Open items / deferrals for TF2 + TF3

- **No allocation creation route yet.** `+ Add allocation` CTA in the project detail header is disabled with a tooltip — gated by `create Allocation` so the affordance still tests CASL, but a future phase needs to land the modal/route. Same pattern for `+ New project` on the list header.
- **`MostUsedResourceCallout` lives in `features/projects/components/`.** TF3 needs to:
  1. Promote it to `src/shared/ui/` per TF0 architect note item 6 so allocation detail + `/analytics/resources` can import it without breaking §5 isolation.
  2. Replace the placeholder `DrillStack` drawer body with real per-user / per-allocation breakdown.
- **Members KPI shows "—".** The KPI card placeholder defers to the Members tab for the actual count to avoid duplicating the per-allocation membership fan-out at the page level. If the architect wants a concrete number, we can promote the fan-out to the container (one extra round-trip per allocation already cached).
- **Project Resource Usage tab uses a hardcoded 30-day window.** The `DateRangePicker` toolbar lands on the analytics surface in TF3; until then the tab uses a fixed `last 30d` range. The component already accepts a `range` prop — switching to URL state is a one-line container change.
- **Project-scoped change-requests page** (`/change-requests?project={id}`) is referenced from the Pending CRs KPI but the change-requests page does not yet filter by project. The KPI link still works (drops the user on the queue) but the filter is a no-op until that page learns the param.
- **PI label on `/projects` list rows shows the raw user id.** The PI label fetch is intentionally not done per-row to keep fan-out bounded. TF3 should consider a server-side rollup with PI name pre-joined.

## Sign-off

- QA visual review: _pending_
- Architect review: _pending_
