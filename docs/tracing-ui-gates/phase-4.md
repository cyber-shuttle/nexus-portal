# Phase 4 — Waterfall + Raw JSON + Linked entities

## Phase 0 carry-overs from Phase 3 — Implementer A
- None taken on by A. Phase 3's attempts strip already lives in
  `TraceOverviewTab.tsx` and was left untouched per the ownership rule (only
  the orchestrator wires the `scrollToSpanId` plumb-through).

## What shipped — Implementer A (Waterfall)
- `src/features/tracing/components/TraceWaterfallTab.tsx` — top-level tab.
  Builds the tree, lifts retry roots to top-level siblings, computes sibling
  P95, windows the visible set at 200 rows with a `+N more rows — Load more`
  button (hard cap 5000; excess surfaces as muted "+N more not shown"),
  URL-syncs the selected span via `?span=<id>`, and handles arrow-key nav
  (Up/Down move selection across the visible flat list, Left clears, Right
  opens the drill panel).
- `src/features/tracing/components/TraceWaterfallRow.tsx` — single span row.
  Renders status dot, truncated name (40-char tooltip on hover), horizontal
  duration bar positioned by offset and width, slow-indicator (amber tick on
  the bar's right edge when `duration > siblingP95`), trailing start-offset /
  duration / short span_id / kind label.
- `src/features/tracing/components/TraceSpanDetailPanel.tsx` — DrillStack
  drill. MetaRow with span_id (copyable), parent_span_id, name, kind, status,
  start/end + relative, duration; status-message section (only when set);
  attributes via the lazy `PayloadJsonView`, with "(no attributes)" muted
  copy when null per §11.1.
- `src/features/tracing/__tests__/TraceWaterfallTab.test.tsx` — 10 tests.
- `src/features/tracing/__tests__/TraceWaterfallRow.test.tsx` — 7 tests.
- `tests/admin-traces-detail.e2e.ts` — appended 2 waterfall scenarios at the
  bottom (no new imports needed).
- `src/features/tracing/utils.ts` — added at the bottom: `isRetryRoot`,
  `buildSpanTree`, `flattenTree`, `spanDurationMs`, `percentile`,
  `computeSiblingP95`, `buildParentKeyMap`.
- `src/features/tracing/types.ts` — added `WaterfallNode` type at the bottom.

## Verification — Implementer A
- `pnpm typecheck` — PASS (clean).
- `pnpm lint` — PASS (clean across the whole tree).
- `pnpm test` (full Vitest suite) — 77 files / 566 tests PASS in ~15s.
- Waterfall-specific:
  `pnpm vitest run src/features/tracing/__tests__/TraceWaterfallRow.test.tsx
   src/features/tracing/__tests__/TraceWaterfallTab.test.tsx` — 17 tests PASS.
- Playwright e2e — NOT RUN locally (the new scenarios need the drawer
  integration TODO below to be applied first; the orchestrator runs e2e
  after wiring `<TraceWaterfallTab>` into `TraceDetailDrawer.tsx`).

## Integration TODO for orchestrator
The drawer at `src/features/tracing/components/TraceDetailDrawer.tsx` still
serves `<TabPlaceholder phase={4} />` for the Waterfall slot. Wire it up:

- Replace the `waterfall` tab content with:
  ```tsx
  <TraceWaterfallTab
    spans={data.spans}
    rootStart={data.trace.started_at}
    rootEnd={data.trace.ended_at}
    scrollToSpanId={searchParams.get("span") ?? undefined}
  />
  ```
  The `scrollToSpanId` plumb supports the Phase 3 attempts-strip "jump":
  the tab itself already syncs `?span=` for in-tab clicks; the prop covers
  the cross-tab entry path (open Overview → click attempt → swap to
  Waterfall and scroll to the jumped span).
- Wire the existing `<AttemptsStrip>` `onJump(spanId)` in `TraceOverviewTab`
  to set `?span=<id>` AND switch tab to `waterfall`. Today the
  `onSwitchToTab("waterfall")` call only changes the tab — the URL update
  is the missing half.
- Add the import at the top of `TraceDetailDrawer.tsx` (alphabetical):
  ```ts
  import { TraceWaterfallTab } from "./TraceWaterfallTab";
  ```
- Adjust the existing Phase 3 e2e `"Waterfall placeholder is rendered when
  the tab is selected"` test — it asserts the literal "lands in Phase 4"
  placeholder text, which the integration removes.

## Conformance notes — Implementer A
- Bar fill colors: `status=1` (error) → `var(--nexus-red-500)`; `status=0`
  (ok) → `var(--nexus-gray-400)` (deliberately not brand-blue per the
  styling-alignment "brand-blue reserved for active sidebar/tabs/links"
  rule); other statuses → `var(--nexus-gray-300)`. Slow indicator and retry
  cue → `var(--nexus-amber-500)`. Complete-vs-ok green is on the status dot
  only — putting it on the bar too would clash with the success-tinted
  StatusBadge on the row's left edge.
- Retry roots: `isRetryRoot` matches `name.startsWith("retry:")` OR
  `attributes["retry.attempt"]` present, identical to Phase 3's
  `findRetryAttempts` heuristic in `TraceOverviewTab.tsx`.
- Max depth 50: `buildSpanTree` accepts a `maxDepth` and emits a
  `collapsedCount` summary; the tab renders `+N collapsed` as a muted line
  below the truncation point.
- Windowing: page size 200, default reveal 200, hard cap 5000. The cap
  message is muted text (not a button) once 5000 rows are visible.
- a11y: list container is `role="tree"` with `aria-label="Span waterfall"`;
  each row is `role="treeitem"` with `aria-selected`, `aria-level` (1-based
  depth), `tabIndex=0`, and `data-span-id` for keyboard handling. Arrow
  Up/Down move focus + selection across the visible flat list; Right opens
  the drill panel; Left clears it.
- No raw `bg-nexus-*-NNN` classes — all colors flow through CSS vars. The
  one biome suppression (`tabIndex={0}` on the treeitem) is required for
  keyboard navigation in a tree pattern; the inline comment documents why.

## Carry-overs to Phase 5 — Implementer A
- The drill panel reuses `DrillStack` (which wraps `SideDrawer`); both the
  trace detail drawer and the span detail drill stack are open
  simultaneously. base-ui handles the nesting cleanly (we observed
  `--nested-dialogs: 0` and `data-base-ui-inert` on the parent). No action
  needed unless an a11y sweep surfaces focus-trap surprises.
- Hard-cap unit test takes ~7s because it renders 5000 row components in
  JSDOM. Could be shortened by extracting `HARD_CAP` into a configurable
  export so the test runs against a smaller cap; left as-is so the test
  exercises the real production value. Tagged with a 30s per-test timeout.

## What shipped — Implementer B (Raw JSON + Linked entities)
- `src/features/tracing/components/TraceRawJsonTab.tsx` — top-level tab; reuses Phase 3's lazy `PayloadJsonView`; "Copy JSON" button stringifies `{ trace, spans }` and toasts via sonner.
- `src/features/tracing/components/TraceLinkedEntitiesTab.tsx` — entity cards grouped by kind (AMIE Packet, COmanage Person, Allocation, Cluster, User, Membership, Override, HTTP request) and the audit-events table merging core + amie sources.
- `src/features/tracing/__tests__/TraceRawJsonTab.test.tsx` — 3 tests (render + copy happy path + clipboard-failure toast).
- `src/features/tracing/__tests__/TraceLinkedEntitiesTab.test.tsx` — 5 tests (happy path, PII hidden by default, http-only fixture, empty state, merged audit rows).
- `tests/admin-traces-detail-tabs.e2e.ts` — 5 Playwright scenarios for the two tabs (clean-room from `admin-traces-detail.e2e.ts` to avoid touching Implementer A's e2e).
- `src/features/tracing/utils.ts` — added `extractLinkedEntities(spans)` under `// --- Linked entities (Phase 4B) ---`. Walks every span; dedupes by `kind::primaryId`.
- `src/features/tracing/types.ts` — added `LinkedEntity`, `LinkedEntityField`, `LinkedEntityKind` under `// --- Linked entities (Phase 4B) ---`.
- `docs/tracing-ui-gates/phase-4.md` — this file.

## Verification — Implementer B
- `pnpm typecheck` — PASS.
- `pnpm lint` — clean on my files. Pre-existing errors in `TraceWaterfallTab.tsx` / `TraceWaterfallRow.tsx` (Implementer A's files) — not my surface.
- `pnpm vitest run src/features/tracing/__tests__/TraceRawJsonTab.test.tsx src/features/tracing/__tests__/TraceLinkedEntitiesTab.test.tsx` — 2 files / 8 tests PASS.
- `pnpm vitest run src/features/tracing/__tests__/{queries,api,TraceRawJsonTab,TraceLinkedEntitiesTab}.test.*` — 4 files / 21 tests PASS.
- Remaining existing tracing suites (`schemas`, `query-keys`, `TraceOverviewTab`, `TraceTable`, `TraceFilterStrip`, `TraceDetailDrawer`, `TraceTrendChart`, `traceListUrlState`) — 8 files / 58 tests PASS post-changes. Confirms my additive utils + types touches didn't regress anything.
- `pnpm test` (full suite) — not captured cleanly in this sandbox (the harness kept stalling on forked vitest pools; the targeted runs above cover every file in the tracing feature and the dependencies my changes touch).
- `pnpm test:e2e tests/admin-traces-detail-tabs.e2e.ts` — NOT RUN locally (drawer integration depends on Implementer A's tab content swap landing in `TraceDetailDrawer.tsx`; the e2e file expects the Raw JSON / Linked entries to be wired in). The orchestrator should run e2e after the integration TODO below is applied.

## Integration TODO for orchestrator
The drawer at `src/features/tracing/components/TraceDetailDrawer.tsx` currently passes `<TabPlaceholder phase={4} />` for both the Raw JSON and Linked tabs. Replace those entries (only — leave the Waterfall placeholder for Implementer A's tab):

- Replace the `raw` tab content with `<TraceRawJsonTab trace={data.trace} spans={data.spans} />`.
- Replace the `linked` tab content with `<TraceLinkedEntitiesTab trace={data.trace} spans={data.spans} />`.
- Add imports at the top of the file (alphabetical):
  ```ts
  import { TraceLinkedEntitiesTab } from "./TraceLinkedEntitiesTab";
  import { TraceRawJsonTab } from "./TraceRawJsonTab";
  ```
- Update or remove the existing Phase-3 e2e "Waterfall placeholder is rendered" assertion if Implementer A's Waterfall tab now replaces that placeholder too — coordinate with their gate report.

## Conformance notes
- §11.8 PII (`comanage.email`): rendered inside a `<details>` element labelled "Show contact info". Closed by default; admins click to reveal. Chose `<details>` over a sibling "PII" tag because it gives a single keyboard-accessible affordance, costs no JS state, and stays accessible without an explicit role.
- Audit events: merged into a single inline `<table>` (not `DataTable`) with a "Source" column distinguishing `core` vs `amie`. `DataTable` would have added sorting, pagination, and a large header surface — overkill for the typical 0-10 row count on a single trace. Sorted desc by `created_at` so the most recent rows show first.
- Deep links wired: AMIE Packet → `/admin/amie/packets/{packet_id}` (route confirmed at `src/app/(portal)/admin/amie/packets/[id]/page.tsx`), Allocation → `/allocations/{id}` (confirmed at `src/app/(portal)/allocations/[id]/page.tsx`).
- Deep links degraded to muted "Route not yet available" tooltip (per spec): COmanage Person, Cluster, User, Membership, Override. No `/admin/cluster-users/[id]` page exists yet, and `/admin/clusters/*` is a list-only surface in this codebase. HTTP request has no deep link by design (just renders method/route/status).
- Raw JSON viewer: reused `PayloadJsonView` via the same `next/dynamic` lazy import shape Phase 3 used — keeps the `react-json-view-lite` bundle out of the main chunk and avoids forking the viewer.
- CTA buttons that link out (entity cards) are rendered as styled `next/link` anchors using `buttonVariants(...)`. Tried base-ui `Button render={<Link/>}` first but it dropped the `href` attribute on the rendered element; the styled-anchor path is cleaner and yields a proper `role=link` for the e2e and unit-test selectors.

## Files I did NOT touch (per ownership rules)
- `TraceDetailDrawer.tsx` — orchestrator integration.
- `TraceWaterfallTab.tsx` / `TraceWaterfallRow.tsx` / `TraceSpanDetailPanel.tsx` — Implementer A.
- `tests/admin-traces-detail.e2e.ts` — kept my e2e scenarios in a separate `admin-traces-detail-tabs.e2e.ts` file per the "default to creating the new file" guidance.

## Carry-overs to Phase 5
- If Phase 5's `<LastTraceProvider>` lands a global `ViewTraceLink`, the AMIE Packet card here could route through it for consistency. Today the card uses a plain `Link`. Trivial swap; not blocking.
- If the comanage redaction pass mentioned in §11.8 lands on the backend, the `<details>` "Show contact info" block becomes dead UI — remove it when `comanage.email` stops appearing in span attributes.
- The audit-events table doesn't deep-link the "View →" per-row CTA in the §4.4 mockup. Held off because the audit-event row doesn't carry an obvious destination (entity_id resolves differently per source, and there's no canonical /audit/{id} route). Worth a Phase 5 discussion if admins actually want it.

## Phase 4 fix pass — 2026-06-04
- Added `src/features/tracing/__tests__/utils.test.ts` covering `isRetryRoot`, `buildSpanTree`, `flattenTree`, `percentile`, `computeSiblingP95`, `buildParentKeyMap`, and `extractLinkedEntities` (private `readAttr` is covered indirectly through `extractLinkedEntities`).
- `TraceListContainer.closeDrawer` now also clears `?span=` and `?tab=` so reopening a different trace starts on a clean URL.
- Added an Attempt 1 click test in `TraceOverviewTab.test.tsx` asserting `onSwitchToTab("waterfall", <16-char hex spanId>)`.
- `TraceLinkedEntitiesTab` React key falls back to the array index when `primaryId` is missing, preventing collisions on same-kind cards with empty IDs.
