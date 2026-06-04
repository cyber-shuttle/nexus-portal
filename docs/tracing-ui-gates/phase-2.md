# Phase 2 — List page (filters, trend chart, table, banner, pagination)

## What shipped

- `src/features/tracing/components/TraceListContainer.tsx` — top-level client
  container; replaces the Phase 1 placeholder, owns URL-state, renders header
  + `LastSyncedBadge`, sticky failure banner, filter strip, trend chart, and
  table.
- `src/features/tracing/components/TraceFilterStrip.tsx` — URL-synced filter
  strip: status & source chip multi-selects, window preset radios with custom
  date inputs, 365d range guardrail, debounced free-text search.
- `src/features/tracing/components/TraceTrendChart.tsx` — Recharts stacked-area
  chart for 30d window. Exposes the `pivotByDay` helper for the wire → chart
  shape conversion.
- `src/features/tracing/components/TraceTable.tsx` — `DataTable` wrapper with
  Started / Trace ID / Root operation / Source / Duration / Status / View
  columns. Copy-on-click trace IDs + sonner toast.
- `src/app/(portal)/admin/traces/page.tsx` — slimmed to a one-line
  `<TraceListContainer />` (header moved into the container).
- `src/app/(portal)/admin/traces/[traceId]/page.tsx` — passes `initialTraceId`
  into the container; container leaves a `// TODO Phase 3` for drawer wiring.
- `src/features/tracing/__tests__/TraceFilterStrip.test.tsx` — 7 unit tests
  for chip toggle, preset switch, custom-range warning, debounced search.
- `src/features/tracing/__tests__/TraceTrendChart.test.tsx` — 6 unit tests
  (pivot helper + skeleton / error / empty render paths).
- `src/features/tracing/__tests__/TraceTable.test.tsx` — 5 unit tests:
  column headers, View click, clipboard + toast, empty-state copy variants.
- `tests/admin-traces-list.e2e.ts` — 2 Playwright specs:
  1. land on page, assert trend chart + first table row, click "error" status
     chip, assert URL gains `status=1`, click first View → URL becomes
     `/admin/traces/<id>`.
  2. axe-core sweep on the page (serious + critical = 0).

## Verification

- `pnpm typecheck` — clean (no output).
- `pnpm lint` — clean (Checked 467 files, no fixes applied).
- `pnpm test` — `Test Files 70 passed (70) / Tests 518 passed (518)` (Phase 1
  baseline was 500; +18 new tests, zero regressions).
- `pnpm test:e2e tests/admin-traces-list.e2e.ts` — `2 passed (11.4s)`.

## Gate criteria status (spec §7.2)

- [x] Playwright e2e: load page, apply filters, see filtered results from MSW.
- [x] axe-core clean on the route (serious + critical violations = 0).
- [ ] Architect-review: status badge token usage, brand color discipline —
  pending architect-review pass.

## Carry-overs from Phase 1

None blocking. Phase 1 fix-pass items (widened source enum, integer status
fallback, sorted multi-value filters, typed `RetryApiError`) are all
consumed cleanly by the Phase 2 components — no remediation needed.

## Conformance notes (per spec §6)

- **No `useEffect` for data fetching.** Two `useEffect` calls in
  `TraceFilterStrip.tsx`: one to mirror parent-driven `value.q` back into the
  local input draft, one to flush the debounced search through to `onChange`.
  Neither performs a fetch; server state is exclusively TanStack-Query.
- **No raw `bg-nexus-*-NNN` classes.** Status chip styles in the filter strip
  use `bg-[color:var(--nexus-green-50)]` etc., matching the convention in
  `StatusBadge.tsx`. Stacked-area chart series colors are CSS-var strings
  passed to Recharts (the styling-alignment doc allows this — it forbids
  raw `bg-nexus-*` Tailwind utilities, not `var(--nexus-*)` references).
- **Skeleton, not spinner.** Trend chart loading = `<Skeleton h-48 w-full />`;
  table loading = 5 skeleton rows.
- **Empty / error states present on every async surface** (trend, table).
- **Sticky banner uses `bg-[color:var(--nexus-amber-50)] /
  border-[color:var(--nexus-amber-200)] / text-[color:var(--nexus-amber-700)]`**
  per the styling doc's amber alert convention. Lucide `AlertTriangle` icon
  inline, button calls `updateFilters` with `status=[1], from=<24h ago ISO>`.
  No dismiss button (spec doesn't ask for one).
- **`StatusBadge` variant mapping** (no new variants added):
  status 0 (ok) → `approved` (green), status 1 (error) → `rejected` (red),
  status 2 (cancelled) → `inactive` (muted), status 3 (orphaned) → `warning`
  (amber). All existing variants in `StatusBadge.tsx`.
- **Forward-compat status codes** route through `getTraceStatusInfo(status)`
  with `Unknown` fallback; chip multi-select hardcodes `[0, 1, 2, 3]` per
  §11.7 — when a new code lands, the chip strip still works (unknown rows
  just render the "Unknown" badge).
- **Source enum** hardcoded to the spec §11.6 four; the Zod schema
  (Phase 1) accepts unknowns via `.or(z.string())` so a new connector's
  rows still parse and render in the table.
- **Pagination caps.** `DataTable` page-size picker is deferred (Phase 6 polish
  per spec §7.6); `TraceTable.tsx` enforces the offset≤1,000,000 ceiling
  defensively (computes the next-page offset before delegating to
  `onPageChange`; ignores clicks that would breach the cap). Default `limit=50`
  matches spec §11.5. `// TODO size picker` is intentionally absent — the
  DataTable's pager primitive already handles Prev/Next/Page-N-of-M.
- **Custom-range cap** at 365d. The strip computes day-delta on the fly and
  renders an inline `role="alert"` warning when exceeded; the filter still
  propagates (no Apply button to disable) so URL state stays observable.
- **Free-text input** debounced via the shared `useDebounce` hook (300ms);
  pushes to `onChange` only when the debounced value differs from the URL's
  `q` to avoid a render loop with the parent.
- **No cross-feature imports.** `features/tracing/` only imports from
  `@shared/*`, `@features/tracing/*`, third-party (`recharts`, `lucide-react`,
  `sonner`, `@tanstack/react-query`).
- **No new "Nexus" or "Lahiru" mentions.** Container subtitle is "View and
  replay request flows across Custos." (matches spec wording verbatim).
- **`pivotByDay` data-shape pivot** is exported so the unit
  test can assert the conversion without rendering Recharts.
- **`URL` round-trip rules.** Empty arrays omit the key; `limit=50` / `offset=0`
  omit; `preset=30d` omits; any filter change resets `offset=0`. Verified by
  the e2e spec (URL after "error" click is `?status=1`, nothing else).

## Judgment calls

- **DataTable page-size picker deferred to Phase 6.** The existing
  `DataTable` primitive exposes Prev/Next/Page-N-of-M but not a page-size
  selector. Per the spec's "Don't extend DataTable for this — Phase 6 can
  polish" guidance, the table runs at the spec default `limit=50`.
  Defense-in-depth offset cap is enforced in `onPageChange`.
- **Window snap to `nowRef`.** The container snaps `Date.now()` into a ref
  on mount so the `from` ISO doesn't tick every render — without this, the
  list/stats query keys mutate on every render and TanStack refetches in a
  loop. Comment in the source explains the why.
- **`Trend chart` colors** use `--nexus-gray-500` for status 2 (cancelled)
  rather than the muted token, since muted is a semantic Tailwind utility
  not exposed as a hex on the chart canvas. The styling doc allows CSS-var
  references.
- **Sticky banner side-query** (`status=[1], from=24h-ago, limit=1`) caches
  separately from the main list query (different filter shape → different
  key). The `total` field is the source of truth for the count even though
  `limit=1` only returns a single row.
- **Snap container header into container.** Phase 1's route page rendered the
  `<h1>Tracing</h1>` header outside the container. Phase 2 needed the header
  to live next to `LastSyncedBadge` synced to `listQuery.dataUpdatedAt`, so
  the header moved into the container and the route page slimmed to a single
  call. Spec wording for subtitle updated to "across Custos." per §7.2.

## Carry-overs to Phase 3

- `TraceListContainer` accepts `initialTraceId?: string` and currently
  no-ops on it (`// TODO Phase 3: open drawer for initialTraceId`). Phase 3
  wires `<TraceDetailDrawer>` to mount when either `initialTraceId` is set
  (deep-link route) or `?trace=<id>` is in the search params (cross-link
  pattern).
- The table's `onView(traceId)` currently `router.push`-es to
  `/admin/traces/<id>`. Phase 3 can either:
  1. Keep that behavior and let the deep-link route handle drawer mount.
  2. Replace with a `?trace=<id>` update so the drawer overlays the list
     without a route transition. Recommended path — matches AMIE packet
     drawer precedent and avoids reflowing the list each click.
- Pagination size picker (10/25/50/100/200) deferred to Phase 6 polish.
- The relative-time helper (`formatRelative`) is currently inline to
  `TraceTable.tsx`. If Phase 3's drawer header reuses it, lift to
  `features/tracing/utils.ts`.
- The container's window snapshot (`nowRef`) is per-mount. If a user keeps
  the page open for hours, the relative-time labels in the table and the
  `LastSyncedBadge` will drift. Phase 6 perf-budget pass can decide whether
  to add a slow ticking refresh or leave it to a refresh click.

## Phase 2 fix pass — 2026-06-03

Spec-compliance review surfaced one gap: §11.5 requires the Next button to be
**disabled** when `offset + limit > 1_000_000`. The original implementation
swallowed the click silently inside `TraceTable.tsx`'s `onPageChange`, so the
control looked enabled but did nothing.

- `src/shared/ui/DataTable.tsx`: added optional `nextDisabled?: boolean` to
  the `DataTablePagination` type; the pager Next `Button` now also disables
  on `nextDisabled` (in addition to the existing `page >= totalPages`
  check). Two-line change; no other consumers touched.
- `src/features/tracing/components/TraceTable.tsx`: passes
  `nextDisabled: nextBlocked` through the pagination prop alongside the
  existing defensive `onPageChange` guard, so the cap is now both visible
  and enforced.
- `src/features/tracing/__tests__/TraceTable.test.tsx`: new test renders the
  table with `offset=999_950`, `limit=100` and asserts the Next button is
  `disabled`.
- `pnpm typecheck && pnpm lint && pnpm test`:
  `Test Files 70 passed (70) / Tests 519 passed (519)` (was 518; +1 new test,
  zero regressions). Lint clean (467 files). Typecheck clean.
