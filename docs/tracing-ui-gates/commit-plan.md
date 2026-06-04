# Commit Plan — Tracing Admin UI

This document groups every file changed/added across Phases 1-6 into commit-sized batches. Each group is a logical commit. The user reviews → `git add <files>` → `git commit -m "<message>"` → moves to the next group.

## Branch

All changes live on `tracing-admin-ui`. Phases 1-6 made **zero `git commit`s**; everything is unstaged in the working tree.

## Suggested landing order

The order below minimizes diff conflicts and ensures each commit builds + tests cleanly in isolation. Earlier groups are pre-requisites for later groups (e.g. the feature scaffold + MSW + CASL + sidebar must land before the list page can render; the list page must land before the drawer wires onto it; the drawer must land before the waterfall/raw/linked tabs replace its placeholders; the retry modal slots into the wired drawer; the polish pass closes out).

---

### Group 1 — Scaffold tracing feature folder, MSW fixtures, and contract doc

**Files:**
- `docs/backend-contracts/traces.md`
- `docs/tracing-ui-gates/phase-1.md`
- `src/app/(portal)/admin/traces/PermissionGate.tsx`
- `src/app/(portal)/admin/traces/layout.tsx`
- `src/features/tracing/api.ts`
- `src/features/tracing/queries.ts`
- `src/features/tracing/schemas.ts`
- `src/features/tracing/types.ts`
- `src/features/tracing/utils.ts`
- `src/features/tracing/__fixtures__/audit-events.fixture.json`
- `src/features/tracing/__fixtures__/stats.fixture.json`
- `src/features/tracing/__fixtures__/trace.amie.failed.fixture.json`
- `src/features/tracing/__fixtures__/trace.amie.success.fixture.json`
- `src/features/tracing/__fixtures__/trace.http.fixture.json`
- `src/features/tracing/__fixtures__/trace.orphaned.fixture.json`
- `src/features/tracing/__fixtures__/traces.list.fixture.json`
- `src/features/tracing/__tests__/api.test.ts`
- `src/features/tracing/__tests__/queries.test.tsx`
- `src/features/tracing/__tests__/query-keys.test.ts`
- `src/features/tracing/__tests__/schemas.test.ts`
- `src/mocks/handlers/traces.ts`
- `src/mocks/handlers/index.ts`
- `src/mocks/handlers/__tests__/traces.test.ts`
- `src/shared/api/client.ts`
- `src/shared/api/last-trace-id.ts`
- `src/shared/api/__tests__/last-trace-id.test.ts`
- `src/shared/casl/abilities.ts`
- `src/shared/layout/navConfig.ts`

**Commit message:** `Scaffold tracing feature folder, MSW fixtures, and backend contract doc`

**Rationale:** Lands the feature folder, route group, CASL ability, sidebar entry, MSW handlers + fixtures, X-Trace-Id capture, and the OpenAPI-like contract doc together — none of the later groups compile without this baseline.

---

### Group 2 — Add tracing list page with filters and trend chart

**Files:**
- `docs/tracing-ui-gates/phase-2.md`
- `src/app/(portal)/admin/traces/page.tsx`
- `src/app/(portal)/admin/traces/[traceId]/page.tsx`
- `src/features/tracing/components/TraceListContainer.tsx`
- `src/features/tracing/components/TraceFilterStrip.tsx`
- `src/features/tracing/components/TraceTable.tsx`
- `src/features/tracing/components/TraceTrendChart.tsx`
- `src/features/tracing/__tests__/TraceFilterStrip.test.tsx`
- `src/features/tracing/__tests__/TraceTable.test.tsx`
- `src/features/tracing/__tests__/TraceTrendChart.test.tsx`
- `src/shared/ui/DataTable.tsx`
- `tests/admin-traces-list.e2e.ts`

**Commit message:** `Add admin tracing list page with filters, trend chart, and pagination`

**Rationale:** Self-contained list UI: container, filter strip, trend chart, table, and the small `nextDisabled` add-on to the shared `DataTable` primitive that the table needs to enforce the offset cap.

---

### Group 3 — Add tracing detail drawer with Overview tab

**Files:**
- `docs/tracing-ui-gates/phase-3.md`
- `src/features/tracing/components/TraceDetailDrawer.tsx`
- `src/features/tracing/components/TraceOverviewTab.tsx`
- `src/features/tracing/components/PayloadJsonView.tsx`
- `src/features/tracing/components/traceListUrlState.ts`
- `src/features/tracing/__tests__/TraceDetailDrawer.test.tsx`
- `src/features/tracing/__tests__/TraceOverviewTab.test.tsx`
- `src/features/tracing/__tests__/traceListUrlState.test.ts`
- `tests/admin-traces-detail.e2e.ts`

**Commit message:** `Add tracing detail drawer with Overview tab and URL-synced span selection`

**Rationale:** Drawer shell + the first tab + the extracted URL-state helpers form one reviewable slice. The drawer ships with Waterfall/Raw/Linked still on placeholders — Phase 4 swaps them in.

---

### Group 4 — Add Waterfall, Raw JSON, and Linked entities tabs

**Files:**
- `docs/tracing-ui-gates/phase-4.md`
- `src/features/tracing/components/TraceWaterfallTab.tsx`
- `src/features/tracing/components/TraceWaterfallRow.tsx`
- `src/features/tracing/components/TraceSpanDetailPanel.tsx`
- `src/features/tracing/components/TraceRawJsonTab.tsx`
- `src/features/tracing/components/TraceLinkedEntitiesTab.tsx`
- `src/features/tracing/__tests__/TraceWaterfallTab.test.tsx`
- `src/features/tracing/__tests__/TraceWaterfallRow.test.tsx`
- `src/features/tracing/__tests__/TraceRawJsonTab.test.tsx`
- `src/features/tracing/__tests__/TraceLinkedEntitiesTab.test.tsx`
- `src/features/tracing/__tests__/utils.test.ts`
- `tests/admin-traces-detail-tabs.e2e.ts`

**Commit message:** `Add Waterfall, Raw JSON, and Linked entities tabs to the trace drawer`

**Rationale:** Three placeholders in one drawer all flip to real tabs at once. Splitting these into three commits would leave at least one tab broken between commits (the drawer wiring lands once); keeping them together preserves a green tree at every checkpoint.

---

### Group 5 — Add retry modal and ViewTraceLink cross-link

**Files:**
- `docs/tracing-ui-gates/phase-5.md`
- `src/features/tracing/components/LastTraceProvider.tsx`
- `src/features/tracing/components/TraceRetryModal.tsx`
- `src/features/tracing/components/ViewTraceLink.tsx`
- `src/features/tracing/__tests__/LastTraceProvider.test.tsx`
- `src/features/tracing/__tests__/TraceRetryModal.test.tsx`
- `src/features/tracing/__tests__/ViewTraceLink.test.tsx`
- `src/shared/layout/PortalLayout.tsx`
- `tests/admin-traces-retry.e2e.ts`
- `tests/cross-link-view-trace.e2e.ts`

**Commit message:** `Add retry modal and ViewTraceLink primitive`

**Rationale:** The retry modal slots into the drawer's Overview tab and depends on `LastTraceProvider` for the deep-link toast. `ViewTraceLink` is the documented cross-feature export; mounting `LastTraceProvider` in `PortalLayout.tsx` is the one shared-layout change that ships alongside. The cross-feature wiring into AMIE / audit / change-request surfaces (spec DoD #13) is backend-blocked — the three host schemas do not carry `trace_id` yet. See `docs/tracing-ui-gates/dod-13-deferred.md` for the deferral note.

---

### Group 6 — Phase 6 polish, a11y sweep, and README

**Files:**
- `README.md`
- `docs/tracing-ui-gates/phase-6.md`
- `docs/tracing-ui-gates/dod-13-deferred.md`

**Commit message:** `Polish tracing UI carry-overs, sweep a11y, and document /admin/traces in the README`

**Rationale:** Carry-over fixes from Phase 5's Phase-0 dispatch (ViewTraceLink filter preservation, TraceRetryModal retry-the-retry handler, PayloadPreview shape, useLastTraceId initialiser, cross-link e2e regex) are surgical edits to files that already landed in Group 5; the README addendum, the Phase 6 gate report, and the DoD #13 deferral ADR are the only new/edited files unique to this group. The carry-over edits ship in Group 5 — they touch files already in that group — so this commit is the documentation + clean-slate attestation only. The `commit-plan.md` file itself is intentionally **not** included in any group; the user decides whether to land it as a hand-off doc.

---

## Verification per group (recommended)

After each `git commit`, run:
- `pnpm typecheck`
- `pnpm test` (vitest)

Do not run e2e per-group (slow). Run all e2e suites after the last commit:
```
pnpm test:e2e tests/admin-traces-list.e2e.ts tests/admin-traces-detail.e2e.ts tests/admin-traces-detail-tabs.e2e.ts tests/admin-traces-retry.e2e.ts tests/cross-link-view-trace.e2e.ts
```

## Notes

- No file appears in more than one group.
- No group is empty.
- Total files changed/added in the repo (modified + untracked): **75** (per `{ git ls-files --modified; git ls-files --others --exclude-standard; } | sort -u | wc -l`).
- Total files distributed across groups: **74**.
- Per-group counts (no overlaps): G1=28, G2=12, G3=9, G4=12, G5=10, G6=3. Sum = 74, matches the in-group total.
- The one file in the repo NOT in any group: **`docs/tracing-ui-gates/commit-plan.md`** — this hand-off doc is intentionally left unstaged. The user decides whether to land it as a final "Phase 6 polish + commit plan" commit alongside Group 6, or keep it as a working document.
- The Phase 5 carry-over edits land inside files already enumerated under Group 5 (`ViewTraceLink.tsx`, `TraceRetryModal.tsx`, `__tests__/ViewTraceLink.test.tsx`, `__tests__/TraceRetryModal.test.tsx`, `cross-link-view-trace.e2e.ts`) and inside `queries.ts` (Group 1 — `useLastTraceId` initialiser nit). They do not introduce new files for Phase 6.
