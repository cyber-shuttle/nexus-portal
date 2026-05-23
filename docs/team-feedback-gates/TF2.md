# Phase TF2 Gate — Cluster enable/disable

**Spec:** `airavata-custos/docs/portal/2026-05-22-nexus-portal-team-feedback-v1.md` §9 phase TF2.
**Baseline commit:** `43e0993 Sign off Phase TF1 gate with fix-up addendum`.
**HEAD commit:** `7d611a3 Move ClustersTable into allocations feature for isolation`.

## Commits in TF2

```
a353363 Promote cluster queries to allocations feature module
6751559 Add Clusters tab to admin resources page with EnableToggle
4369fcc Filter cluster selectors to enabled clusters only
39e0a7e Document clusters backend contract
b055336 Add TF2 unit and e2e tests for cluster toggle and propagation
9b12b0f Add Phase TF2 gate report
7d611a3 Move ClustersTable into allocations feature for isolation
```

## TF0 carry-over status — cluster queries promotion

| # | Item | Status | Where |
|---|---|---|---|
| 1 | Promote `clusterKeys`, `useClusters`, `useEnabledClusters`, `useUpdateClusterStatus` from `@features/admin/queries` to `@features/allocations/queries` | DONE | `src/features/allocations/queries.ts:23-57` |
| 2 | Promote `clusterStatusSchema`, `clusterSchema`, `updateClusterStatusPayloadSchema` (+ `Cluster` / `ClusterStatus` / `UpdateClusterStatusPayload` types) to `@features/allocations/schemas` | DONE | `src/features/allocations/schemas.ts:12-42` |
| 3 | Promote `listClusters`, `updateClusterStatus`, `ListClustersParams` to `@features/allocations/api` | DONE | `src/features/allocations/api.ts:41-63` |
| 4 | Remove cluster code from `@features/admin/*` so the §5 isolation rule is structurally enforced (no `@features/admin → @features/allocations` cross-feature import path needed by anyone) | DONE | `src/features/admin/api.ts:31-34` (replaced with breadcrumb comment); `src/features/admin/queries.ts:48-51`; `src/features/admin/schemas.ts:3-6` |
| 5 | Move the cluster fetcher unit tests to the new location | DONE | `src/features/allocations/__tests__/clusters.test.ts` (was `src/features/admin/__tests__/clusters.test.ts`) |
| 6 | Update MSW handler to import from the new location | DONE | `src/mocks/handlers/clusters.ts:4` |

## Pages shipped

### `/admin/resources` Clusters tab (spec §6.5)

- Route shell: `src/app/(portal)/admin/resources/page.tsx` — wraps the existing `ResourcesContainer` and the new `ClustersContainer` in a `TabsRouter` with `defaultValue="clusters"`. Header changed to `Resources & Clusters` to reflect the dual scope.
- Container: `src/app/(portal)/admin/resources/ClustersContainer.tsx` — CASL gate computes `canManage = ability.can('manage', 'all') || ability.can('manage', 'Cluster')`, pulls `useClusters({})` for the unfiltered list, calls `useUpdateClusterStatus` on toggle.
- Presentational: `src/features/allocations/components/ClustersTable.tsx` — DataTable with columns `Cluster · Type · Location · # Allocations · # Users · Status (EnableToggle)`, filter strip with search + status + type, empty state, error retry, muted treatment on DISABLED rows via `opacity-70` only (stacking with `text-muted-foreground` failed WCAG AA contrast at 12px). The component lives under `features/allocations/` (not `features/admin/`) so the §5 isolation rule holds — the admin container imports a feature module from the allocations domain, never the other way around.
- Existing `ResourcesContainer.tsx` had its duplicate `<h1>` removed so it nests cleanly under the new page-level header.

Per-row impact summary feeding the EnableToggle dialog:

```
impact = {
  activeAllocations: row.allocation_count,
  activeUsers: row.user_count,
  inflightJobs: row.inflight_jobs,  // optional
}
```

The numbers come straight from the cluster row the MSW handler builds — see `src/mocks/handlers/clusters.ts:18-34`. The handler always recomputes counts off the seed so the admin sees the actual footprint regardless of status.

### Selector wiring — `useEnabledClusters()` consumers

The grep `useClusters|getComputeClusters|computeClusters` against `src/features/proposals`, `src/features/signer`, `src/app/(portal)/proposals`, `src/app/(portal)/signer` returns **zero hits today**: no module currently surfaces a cluster picker. The flows the spec calls out (proposal wizard, allocation creation, SSH cert allocation picker) all defer cluster choice to other affordances (resource picking, allocation id, etc.).

We documented the wiring obligation in-place so the next phase that adds a cluster picker hits the TODO immediately:

| Consumer | TODO location | What to wire |
|---|---|---|
| Proposal wizard / "Add allocation" flow | `src/features/proposals/api.ts:14-19` | When a cluster step ships, pull options from `useEnabledClusters()` from `@features/allocations/queries`. |
| SSH cert issuance flow | `src/features/signer/api.ts:35-39` | When issue-cert lands (today only list + revoke exist), gate the allocation picker so allocations on DISABLED clusters are filtered. |

The hook itself is callable today from anywhere under `@features/allocations/queries` and is fully tested in `src/features/allocations/__tests__/cluster-queries.test.tsx`.

## DoD criteria — TF2

- [x] `/admin/resources` gains a `TabsRouter` (Clusters default + Resources existing).
- [x] `ClustersTable` renders one `EnableToggle` per row.
- [x] `useEnabledClusters()` lives in `@features/allocations/queries` (TF0 carry-over) and is the single canonical entry point.
- [x] No existing cluster picker exists in proposals / signer; TODOs anchor the wiring obligation in-place for the next phase that introduces one.
- [x] SSH signer issuance check deferred — no issue-cert flow ships in TF2; TODO comment in `features/signer/api.ts` per spec instructions.
- [x] CASL gate: `EnableToggle` rendered with `disabled={!canManage}` for non-admin personas; the read-only aria-label suffix lets screen readers see the state without inviting interaction.
- [x] Disabled rows visually muted (`opacity-70` per cell — stacking `text-muted-foreground` failed AA contrast at 12px).
- [x] Backend-contract doc `docs/backend-contracts/clusters.md` published (92 lines: migration, two endpoints, selector semantics, audit ask).
- [x] Unit tests:
  - `src/features/allocations/__tests__/cluster-queries.test.tsx` — 4 hook tests (enabled filter URL, no-DISABLED leak, full-list pass-through, mutation triggers invalidation cascade).
  - `src/features/allocations/components/__tests__/ClustersTable.test.tsx` — 8 tests (render, muted treatment, CASL read-only, status filter onChange, local filter narrowing, dialog impact + confirm, empty state, error retry).
- [x] E2E tests:
  - `tests/admin-clusters.e2e.ts` — 3 tests (default tab + three rows, toggle + dialog + persistence, status filter).
  - `tests/cluster-filter-propagation.e2e.ts` — 1 test (disabling Nexus-A drops it from Status=ENABLED view; Status=All still shows it).
  - `tests/a11y-admin-clusters.e2e.ts` — 1 axe sweep across the Clusters tab.
  - Updated `tests/admin-resources.e2e.ts` — Resources tab now reached via `?tab=resources` after the TabsRouter change.
- [x] `pnpm verify` green: lint clean, typecheck clean, 339/339 tests, build clean.
- [x] `pnpm test:e2e --workers=1` green: 82 passed, 1 skipped (pre-existing).
- [x] Cross-feature isolation greps: 2 pre-existing entries (`src/features/projects/__tests__/list-container-helpers.test.ts → @features/usage/schemas`, `src/features/allocations/components/AllocationDetailHeader.tsx → @features/allocations/schemas` — same-feature, documented in TF0/A0/S3); zero new violations.
- [x] Hardcoded brand-utility greps zero.
- [x] All 5 commits on `main` are individually `pnpm build` clean.

## Verification commands & output

```bash
pnpm verify   # lint + tsc + vitest (339/339) + next build → clean
pnpm test:e2e --workers=1   # 82 passed, 1 skipped in 4.2m
grep -rn "from ['\"]@features/" src/features/   # 2 pre-existing (S3/A0/TF0-allowed)
grep -rn "from ['\"]@features/" src/shared/     # 0
grep -rnE "from ['\"](@features|@shared)/" src/lib/   # 0
grep -rn "from ['\"]\\.\\./[^'\"]*features/" src/features/   # 0
grep -rnE "\b(text|bg|border)-nexus-(blue|red|green|amber|gray)-[0-9]+\b" src/   # 0
```

## Open items / deferrals for TF3

- **No cluster picker UI exists yet.** Proposal wizard picks resources, not clusters; SSH signer only lists + revokes. The TODOs in `features/proposals/api.ts` and `features/signer/api.ts` anchor the wiring obligation so the next phase that adds a cluster picker hits them immediately. Spec §9 TF3 doesn't add a new picker either — leave the TODOs in place for the broader allocation-creation work in a future phase.
- **`MostUsedResourceCallout`** still lives at `src/features/projects/components/`. TF3 promotes it to `src/shared/ui/` per TF0 architect note when allocation detail + `/analytics/resources` need to import it (§9 TF3).
- **`/admin/resources` Resources tab is reached via `?tab=resources`** after the TabsRouter migration. Any deep-link out there (saved bookmarks, docs) needs to be updated; the change is intentional and matches the spec's default-to-Clusters call.
- **Inflight-jobs count.** `inflight_jobs` is optional on the cluster row; the MSW handler doesn't populate it (seed has no jobs concept). When the backend wires the real endpoint with the jobs join, the EnableToggle dialog will pick it up automatically — no UI change needed.
- **`useEnabledClusters` invalidation strategy.** The mutation invalidates the entire `clusters` query key tree. If at scale the admin Clusters table grows large enough that a re-fetch is expensive, switch to `setQueryData` with optimistic update.
- **Status filter wraps a third dropdown (Type) when only one type ("Compute") exists in the seed.** This is fine for TF2 but may want a "hide when only one option" guard in TF3 polish.

## Sign-off

- QA visual review: _pending_
- Architect review: _pending_
