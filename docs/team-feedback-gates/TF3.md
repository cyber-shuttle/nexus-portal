# Phase TF3 Gate — Resources tab + MostUsedResourceCallout promotion

**Spec:** `airavata-custos/docs/portal/2026-05-22-nexus-portal-team-feedback-v1.md` §5.1 (sitemap — Resources tab inside `/analytics`), §6.4, §9 TF3.
**Baseline commit:** `986066c Sign off Phase TF2 gate with architect and QA results`.
**HEAD commit:** `5d4836f Add e2e and axe coverage for Resources tab`.

## Commits in TF3

```
1f4c253 Promote MostUsedResourceCallout to shared UI
2011bc4 Render EnableToggle dialog labels with resource kind
153b9df Add Resources tab to /analytics shell
7e35250 Surface most-used resource callout on allocation detail
1b7a341 Point project Resource Usage link at analytics Resources tab
98e5ed8 Document Resources tab aggregate endpoint contract
5d4836f Add e2e and axe coverage for Resources tab
```

## TF0 + TF2 carry-over status

| # | Item | Status | Where |
|---|---|---|---|
| 0a | Promote `MostUsedResourceCallout` from `features/projects/components/` to `src/shared/ui/` so allocation detail + analytics can reuse without crossing §5 isolation | DONE | `src/shared/ui/MostUsedResourceCallout.tsx`; consumers in `ProjectResourceUsageTab.tsx:8`, `CreditsAndResources.tsx:7-10`, `ResourcesAnalytics.tsx:12-14` |
| 0b | Seed fixture for 3 clusters with one DISABLED for QA visibility | ALREADY DONE | `src/mocks/seed/index.ts:129-136` was committed in `95ac517` (pre-dates TF2 signoff). TF2 visual-QA note was stale; no fixture edit needed. |
| 0c | EnableToggle dialog button labels echo the resource kind ("Disable cluster" / "Enable cluster") | DONE | `src/shared/ui/EnableToggle.tsx:71-77` (action label composition), `194` (Confirm button), `175` (ErrorState heading). Tests updated in `EnableToggle.test.tsx`, `ClustersTable.test.tsx`, `admin-clusters.e2e.ts`, `cluster-filter-propagation.e2e.ts`. |

## Resources tab composition (spec §5.1 + §6.4)

### `/analytics` shell

- `src/app/(portal)/analytics/page.tsx` is unchanged — the per-persona switch container now wraps the persona content in a `TabsRouter`.
- `src/app/(portal)/analytics/AnalyticsPersonaSwitch.tsx` switches from "render persona container" to "render TabsRouter with two tabs":
  - **Overview** (default) — wraps the existing `Researcher`/`PI`/`AdminAnalyticsContainer` per persona.
  - **Resources** — single `ResourcesAnalyticsContainer` that handles all three personas internally (the data shape is identical; only scope + labels differ).
- URL state: `?tab=overview|resources` (default overview, URL key omitted when default). Saved-view URL params (`preset`, `from`, `to`, `gb`) live underneath the tab key so saved views are tab-scoped automatically.

### ResourcesAnalyticsContainer

`src/app/(portal)/analytics/ResourcesAnalyticsContainer.tsx`:

- Client component.
- Reads persona from props (resolved server-side by `personaForAnalytics`).
- CASL gate per persona: admin = `manage Analytics`; PI = `read AnalyticsPI` on any owned project (or empty projects falls through); researcher = `read AnalyticsResearcher` on own user id.
- Per-persona fan-out:
  - Researcher: `useMembershipsForUser(userId)` → distinct allocation ids.
  - PI: `useProjectsAsPi(userId)` → per-project allocation lists → flatten.
  - Admin: `useAdminAllocationsFull()` (gated via the new `enabled` option on the helper so non-admin paths don't burn an admin payload).
- Per-allocation queries: detail, resources, memberships, usages (with the active date-range window).
- Aggregation client-side via the new `groupTotals` / `resourceGroupMatrix` / `topConsumers` helpers (TF3 additions to `src/features/analytics/aggregations.ts`). The proposed `/compute-allocation-usages/aggregate` endpoint (documented in `docs/backend-contracts/analytics.md §8`) collapses the fan-out when the backend ships it — swap is a query replacement, not a UI rewrite.
- URL state: shared `useUrlRange` + `useUrlGroupBy` with one chip slot.

### ResourcesAnalytics presentational

`src/features/analytics/components/ResourcesAnalytics.tsx`:

```
<header>
  <Toolbar>
    <LastSyncedBadge />
    <DateRangePicker />
    <GroupByChipGroup>
      <GroupByChip label="Group" options={[Allocation, User, Project]} />
    </GroupByChipGroup>
    <SavedViewChips />
    <SaveViewPopover />
  </Toolbar>
</header>

<StatCardRow cols={4}>
  <KpiCard title="Total SUs used" />
  <KpiCard title="Top resource" />
  <KpiCard title="Top allocation" />
  <KpiCard title="Most-active user" />
</StatCardRow>

<AnalyticsCard title="Most-used resource">
  <MostUsedResourceCallout topN={5} onRowClick=opens-drill />
</AnalyticsCard>

<AnalyticsCard title="Usage over time">
  <StackedAreaUsage seriesKeys={resourceIds} onSegmentClick=opens-drill />
</AnalyticsCard>

<grid cols={2}>
  <AnalyticsCard title="Resource × Group matrix">
    <ComplianceMatrix rows={topResources} cols={topGroups} onCellClick=opens-drill />
  </AnalyticsCard>
  <AnalyticsCard title="Top consumers">
    <DataTable rows={topConsumers} onRowClick=opens-drill />
  </AnalyticsCard>
</grid>

<DrillStack>
  // 3 drill kinds: callout (resource), matrix (resource × group), consumer (group row)
</DrillStack>
```

Group-by is a single chip (Allocation / User / Project) — the data is wide enough that combining cuts would blow the matrix open. The same chip rewrites the matrix's column axis, the consumers table's row labels, and the drill drawer's primary descriptor.

## MostUsedResourceCallout adoption — 3 sites

| Site | File:Line | Notes |
|---|---|---|
| Allocation detail Credits & Resources tab | `src/features/allocations/components/CreditsAndResources.tsx:97` | Lives above the per-resource card grid. Default sort of the card grid now keys on "Used %" desc so the most-used resource lands at the top right of the callout (TF3 §4). Click opens a deep-link into `/analytics?tab=resources&allocation={id}&resource={rid}`. |
| Project Resource Usage tab | `src/app/(portal)/projects/[id]/ProjectResourceUsageTab.tsx:98` | TF1 origin site; now imports from `@/shared/ui/...`. Header link points at `/analytics?tab=resources&project={id}` (was `/analytics/resources?project=...` — a dead path). |
| Analytics Resources tab | `src/features/analytics/components/ResourcesAnalytics.tsx:210` | Wrapped in an `AnalyticsCard` titled "Most-used resource". `onRowClick` opens the in-page DrillStack with resource detail rather than navigating away. |

The component itself is now in `src/shared/ui/MostUsedResourceCallout.tsx` (moved via `git mv`, pure-presentational so the move is mechanical). The built-in DrillStack fallback only fires when the caller doesn't supply `onRowClick`, which keeps the project Resource Usage tab interactive while the two new consumers route drills through their own drawers.

## Backend contract

`docs/backend-contracts/analytics.md §8` adds the proposed
`GET /compute-allocation-usages/aggregate?group_by=allocation|user|project|resource&from&to&project_id?&allocation_id?` endpoint with response sketch `Array<{ key, label, total_su, total_raw }>`. Status flagged as **NOT MSW-mocked yet** — portal fans out client-side until backend ships it.

## DoD status

- [x] `/analytics` is now a TabsRouter shell with Overview (default) + Resources tabs.
- [x] `ResourcesAnalyticsContainer` handles all three personas; CASL-gated per persona; documents the client-side fan-out / aggregate gap.
- [x] `ResourcesAnalytics` renders Toolbar + KPI strip (4 cards) + Most-used resource callout + Usage over time stacked area + Resource × Group matrix + Top consumers table + DrillStack.
- [x] DrillStack opens from callout row click, matrix cell click, and chart segment click — three drill kinds in one drawer.
- [x] `MostUsedResourceCallout` moved to `src/shared/ui/` and adopted by all 3 sites (allocation detail + project Resource Usage tab + analytics Resources tab).
- [x] Allocation detail per-resource card grid default-sorts by "Used %" desc (callout + grid render the same top-of-stack resource).
- [x] Project Resource Usage tab "Explore in Analytics" link points to the live `/analytics?tab=resources&project={id}` path.
- [x] Saved Views (A4) namespaced by tab — the URL `?gb=` slot 0 on the Resources tab carries the group-by chip; existing persona saved views stay tab-scoped because they were saved against the Overview URL shape.
- [x] Backend contract sketch published (`docs/backend-contracts/analytics.md §8`).
- [x] TF0 carry-over (callout promotion) and TF2 carry-overs (EnableToggle copy) closed in dedicated commits.
- [x] Cross-feature isolation greps unchanged from TF2 baseline (only pre-existing entries, all documented; new TF3 work introduced zero new cross-feature imports — `features/analytics` imports zero other `@features/` modules from its components directory).
- [x] Hardcoded brand-utility greps zero.
- [x] All 7 commits on `main` are individually `pnpm build` clean.
- [x] Unit tests: `src/features/analytics/__tests__/resources-aggregations.test.ts` covers `groupTotals` (rollup + tie-break + skip-empty), `topConsumers` (share-of-total + tie-break + zero / over-N edges), `resourceGroupMatrix` (intersection rollup + missing-resource fallback + skip-empty).
- [x] E2E tests: `tests/analytics-resources.e2e.ts` covers all three personas seeing the tab + regions, group-by chip rewrites URL + matrix label, callout click opens DrillStack. `tests/a11y-analytics-resources.e2e.ts` axe sweep on the admin path.
- [x] `pnpm verify` green: lint clean, typecheck clean, 349/349 tests, build clean.
- [x] `pnpm test:e2e --workers=1` green: 88 passed, 1 skipped (pre-existing).

## Verification commands & output

```bash
pnpm verify
# > nexus-portal@0.1.0 lint /Users/lahiruj/Projects/dev/apache/nexus-portal
# > biome lint .
# Checked 395 files in 42ms. No fixes applied.
# > nexus-portal@0.1.0 typecheck /Users/lahiruj/Projects/dev/apache/nexus-portal
# > tsc --noEmit
#  Test Files  49 passed (49)
#       Tests  349 passed (349)
# build: Next.js production bundle compiled clean; `/analytics` route bundle = 52.4 kB

pnpm test:e2e --workers=1
# Running 89 tests using 1 worker
#   1 skipped
#   88 passed (4.6m)
```

### Cross-feature isolation greps (post-TF3)

```bash
grep -rn "@features/" src/features/analytics/ --include="*.tsx" --include="*.ts"
# (zero — analytics presentational components reference only @/shared/* and @/lib/*)

grep -rn "@features/" src/features/projects/ --include="*.tsx" --include="*.ts"
# src/features/projects/__tests__/list-container-helpers.test.ts (pre-existing; documented TF0/TF2)

grep -rn "@features/projects/components/MostUsedResourceCallout" src/
# (zero — old import path fully retired)
```

### MostUsedResourceCallout adoption greps (post-TF3)

```bash
grep -rn "MostUsedResourceCallout" src/ | grep -v "shared/ui/MostUsedResourceCallout"
# 3 distinct consumers as documented above
```

## Open items for TF4

1. **Compliance matrix warn-band contrast.** TF3 `ResourcesAnalyticsContainer` skips the amber `warn` band entirely (jumps from `ok` green to `hot` red at the 0.6 threshold) because amber-700 on amber-100 fails WCAG AA at the 12px cell font (4.03:1, needs 4.5:1). Admin A3 noted the same nit but the resources matrix has many more cells so the violation surfaces consistently. TF4 should adjust the shared `ComplianceMatrix` band tokens (amber-900 on amber-100, or boost cell font weight to 600+ qualifying as bold) so the three-band heatmap can come back.
2. **Aggregate endpoint adoption.** When backend ships `/compute-allocation-usages/aggregate`, swap the per-allocation fan-out in `ResourcesAnalyticsContainer` for a single round trip. Contract sketch in `docs/backend-contracts/analytics.md §8`.
3. **Resource-tab callout drill drawer richness.** TF3 ships a stat-card drill; a follow-up phase can add per-user time-series for the selected resource (today the drawer is a snapshot summary).
4. **MostUsedResourceCallout legacy DrillStack.** The built-in fallback drawer is only used by the project Resource Usage tab. When that tab adopts a drill convention of its own, the fallback can be removed from the shared component.
5. **PI/researcher Resources tab project filter.** The TF3 implementation reads the active scope from membership-derived data but the URL param `project={id}` (passed by the project Resource Usage tab link) is not yet filtered server-side. TF4 should read it and narrow the per-allocation fan-out to that project's allocations.

## Sign-off

Pending architect + visual QA review.

## Architect-review (APPROVED)

All 12 verification items pass. Container/presentation seam correct: `ResourcesAnalyticsContainer` at route layer (12 cross-feature imports), `features/analytics/components/` zero cross-feature. Aggregation primitives (`groupTotals`, `topConsumers`, `resourceGroupMatrix`) well-shaped + tested. CASL composition correct (researcher member-only, PI per-project, admin all). MostUsedResourceCallout promoted + consumed by exactly 3 sites. Backend-contract aggregate endpoint sketched in `analytics.md §8`.

### Strengths
- Drill drawer unification with discriminated-union state across 3 drill kinds.
- Per-allocation fan-out documented + bounded; aggregate endpoint is the architecturally clean escape hatch.
- 8 plain imperative commits.
- TS strict, zero `any`.

### Open items (TF4)
1. **Matrix warn-band skip** (green → red at 0.6 ratio) — boost amber contrast via `--nexus-amber-800` on `--nexus-amber-100` OR bold cell font weight.
2. `window.location.assign` in `CreditsAndResources.tsx:106` → switch to `useRouter().push()` for SPA navigation.
3. `${rid}::${k}` composite map key in `resourceGroupMatrix` — consider typed tuple key if extended.
4. Retire fallback drawer in `MostUsedResourceCallout` once project Resource Usage tab adopts its own drill convention.

Sign-off: APPROVED. TF4 may proceed.

## Visual QA (PASS-WITH-NOTES)

All spec §6.4 regions present. Group-by change propagates URL + matrix heading + KPI + table. DrillStack works with breadcrumb. Callout on all 3 sites verified. Admin scope expansion confirmed (Total SUs 22,178 PI → 31,948 admin). Zero console errors.

### LOW (TF4 polish)
1. Group-by surface is one dropdown chip ("Group: all" with menu items By allocation/By user/By project) vs spec §6.4's "3 GroupByChips" — implementer chose tidier single-chip pattern. Align with design intent.
2. `?project=` deep-link param accepted but doesn't filter — the page still shows full PI scope. Wire actual filter in TF4 (or downgrade the link to documentation-only).
3. "Explore in Analytics →" arrow glyph not in a11y tree — visual confirm needed.

Sign-off: PASS-WITH-NOTES. TF4 may proceed.
