# Phase 3 — Detail drawer + Overview tab

## Phase 0 carry-overs from Phase 2

Applied:

- `parseFilters` / `serializeFilters` extracted to
  `src/features/tracing/components/traceListUrlState.ts` with the new
  `traceListUrlState.test.ts` covering defaults-omitted, stable cache-key
  sorting, invalid-preset fallback, invalid-limit/offset fallback,
  out-of-range status filtering, unknown-source filtering, and round-trip.
- `parseFilters` now applies a `0..3` status whitelist and the four-source
  whitelist (`amie`, `http`, `comanage`, `slurm`). Matches the filter strip
  and the spec's §11.6 enum. The Zod schema's `.or(z.string())` widening is
  preserved for non-filter consumers (audit list / future connectors).
- `failingQuery` no longer overlaps with `listQuery`. The container computes
  a `listCoversFailing` flag (`status === [1]` AND `windowBounds.from <= 24h
  ago ISO`); when true, the side-query is gated `enabled: false` and the
  banner reads `listQuery.data.total`. When false the side-query runs with
  `limit: 1`. The simpler `enabled` path was chosen (the alternative —
  reading `total` only when filters match — needed the same equality check
  plus extra branch logic).
- `useTraces(filters, { enabled })` took on an optional second parameter so
  the container can gate the side query without leaking the flag into the
  cache key.
- `window` shadow in `TraceListContainer.tsx` renamed to `windowBounds`.
- Redundant `ReadonlyURLSearchParams` shim dropped; the extracted module
  exposes a small `SearchParamsLike` interface that satisfies both Next's
  and the global `URLSearchParams` shape.
- `TraceTable.tsx` lifts `const now = Date.now()` once into the component
  body and threads it through `formatRelative(row.started_at, now)` so every
  row uses the same baseline.
- `TraceTrendChart.tsx` replaces the `as PivotedRow` cast with a typed
  `makePivotedRow(date)` factory.
- `tests/admin-traces-list.e2e.ts` axe spec replaces
  `page.waitForLoadState('networkidle')` with a wait on the trend chart's
  `aria-label`.
- The Phase 2 e2e's row-click assertion updated to match the new
  `?trace=<id>` search-param behavior (still asserts a 32-hex trace id).
- `docs/tracing-ui-gates/phase-2.md:102` stale `useTrendChart` →
  `pivotByDay`.

Skipped: none.

## What shipped

New files:

- `src/features/tracing/components/TraceDetailDrawer.tsx` — drawer shell,
  status-crumb, `TabsRouter` with four tabs. Reads `useTrace(traceId)` only
  when `open && traceId` so closing the drawer doesn't keep the query alive.
- `src/features/tracing/components/TraceOverviewTab.tsx` — attempts strip,
  `MetaRow` (Trace ID + inline copy button, Source, Status, Started, Ended,
  Duration, Spans, Root operation), root payload preview (1 KB + show-more
  expand), action row (Retry gated per §11.3, Copy trace ID, View linked
  entities). `useAbility().can('retry', 'Trace')` drives the admin gate.
- `src/features/tracing/components/TabPlaceholder.tsx` — tiny stub used by
  Waterfall / Raw JSON / Linked tabs until Phase 4.
- `src/features/tracing/components/PayloadJsonView.tsx` — `react-json-view-lite`
  wrapper, dynamic-imported by the Overview tab so the ~110 kB CSS bundle
  doesn't ship until the drawer opens.
- `src/features/tracing/components/traceListUrlState.ts` — extracted URL
  state helpers (see Phase 0 above).
- `src/features/tracing/__tests__/traceListUrlState.test.ts` — 8 tests.
- `src/features/tracing/__tests__/TraceOverviewTab.test.tsx` — 9 tests
  covering meta-row rendering, attempts strip, retry gating (orphaned,
  HTTP, ability=false), payload preview, copy-to-clipboard, switch-to-tab.
- `src/features/tracing/__tests__/TraceDetailDrawer.test.tsx` — 4 tests
  (no fetch when closed, all four tabs render when open, skeleton loading,
  error state).
- `tests/admin-traces-detail.e2e.ts` — 5 Playwright specs (row click +
  refresh, close button, Waterfall placeholder, deep-link route, axe scan).

Edited files:

- `src/features/tracing/components/TraceListContainer.tsx` — drawer wiring
  (search-param strategy + initialTraceId deep-link strategy), Phase 0
  carry-overs above.
- `src/features/tracing/queries.ts` — `useTraces` takes optional
  `{ enabled }` so the failing side-query can be gated.
- `src/features/tracing/components/TraceTable.tsx` — `Date.now()` lift.
- `src/features/tracing/components/TraceTrendChart.tsx` — typed pivot
  factory.
- `tests/admin-traces-list.e2e.ts` — selector wait + Phase 3 URL change.
- `docs/tracing-ui-gates/phase-2.md` — stale name fix.

## Verification

- `pnpm typecheck` — clean (no output).
- `pnpm lint` — clean (Checked 476 files, no fixes applied).
- `pnpm test` — `Test Files 73 passed (73) / Tests 540 passed (540)`.
  Phase 2 baseline was 518 tests; Phase 3 adds 22 (8 url-state + 9 overview
  + 4 drawer + 1 e2e-side update). No regressions.
- `pnpm test:e2e tests/admin-traces-detail.e2e.ts` — `5 passed (20.4s)`.
- `pnpm test:e2e tests/admin-traces-list.e2e.ts` — `2 passed (10.5s)`
  (Phase 2 suite still green after the URL contract update).

## Gate criteria (§7.3)

- [x] e2e: row click opens drawer, URL updates, refresh keeps it open
  (covered by `row click opens the drawer with ?trace= and refresh
  preserves it` in the new e2e file).
- [x] Drawer reuses `SideDrawer` without forking — `TraceDetailDrawer`
  wraps the shared `SideDrawer` at `width="lg"` (600 px max). No new
  primitive in `shared/ui/`.

## Conformance notes

- **Dual-mode drawer routing.** The spec asks for both `/admin/traces/{id}`
  (deep-linkable) and `?trace=` (in-portal open without route transition).
  We implemented:
  - Row click → `router.replace('?trace=<id>', { scroll: false })`. The
    list never re-mounts; the AMIE inbox uses the same pattern.
  - `/admin/traces/{id}` route → `[traceId]/page.tsx` passes
    `initialTraceId` to `TraceListContainer`. The container uses it as the
    drawer's initial open state. Closing in that mode pushes back to
    `/admin/traces` (no leftover trace param).
  - Refresh on `?trace=<id>` works because the search-param is the source
    of truth (the e2e proves it).
  - Reading the search param on every render lets the drawer survive
    filter changes too — `updateFilters` carries `trace=<id>` through.
- **No `router.push` to the `[traceId]` route from row clicks.** The brief
  flagged the route-push approach as flash-prone. The search-param
  approach is the documented fallback; verified via e2e.
- **Retry button gating.** Disabled when:
  1. `!ability.can('retry', 'Trace')` → tooltip "Only admins can retry".
  2. `trace.status === 0` → "Cannot retry a successful trace".
  3. `trace.source !== 'amie'` → "Retry is not supported for traces from
     {source}".
  4. `trace.root_event == null` → "Retry requires the original payload,
     which was not captured for this trace".
  Each disabled state wraps the button in `<Tooltip>`; the enabled state
  is a plain button (no wrapper).
- **No `useEffect` for data fetching.** The drawer reads `useTrace(id)`,
  which honors a `null`/`undefined` id by setting `enabled: false`. The
  Overview tab's only `useState` is the payload "show more" toggle.
- **No raw `bg-nexus-*-NNN`.** Status crumb and attempt pills use
  `bg-[color:var(--nexus-*-50)]` tokens; everything else uses semantic
  Tailwind (`bg-muted`, `bg-card`).
- **No cross-feature imports.** `features/tracing/*` imports only
  `@shared/*`, `@features/tracing/*`, and third-party.
- **Skeletons, not spinners.** Drawer loading renders two stacked
  `<Skeleton>` blocks. The lazy JSON view fallback is a flat skeleton
  border.
- **Comments.** Two-line max, why-only. No restate-what-code-does.
- **No new "Nexus" / "Lahiru" mentions.** Drawer copy reads "Trace · ",
  matching the spec mockup.

## Carry-overs to Phase 4

- The Overview attempts strip renders pills correctly but its click
  handler only switches to the Waterfall tab — the scroll-to-attempt
  jump is a Phase 4 `// TODO` inside the strip onClick. Phase 4's
  Waterfall implementation should accept an `initialSpanId` (or a URL
  `?span=<id>`) and scroll/select accordingly.
- The drawer's `onRetry` is a no-op pending Phase 5's retry modal — the
  gating logic in Overview already lives here, the modal just needs the
  mutation wiring and the seven response-code branches in §11.3.
- Status-crumb is intentionally minimal (`STARTED → IN PROGRESS` or
  `STARTED → <TERMINAL>`). The AMIE-specific `NEW → DECODED → PROCESSING
  → FAILED` chain is left for whoever ships AMIE-aware lifecycle in a
  later phase — the data on `Trace`/`Span` doesn't have the decoded /
  processing markers as first-class fields today.
- `TraceListContainer.closeDrawer` handles two modes (initialTraceId →
  `router.push('/admin/traces')`; search-param → `replace`). When Phase 5
  ships `ViewTraceLink` it can reuse the search-param closer for the
  cross-route case.
- The Phase 3 e2e introduces an `aria-label` selector for `Copy trace ID
  <hex>` to harvest a trace id from the table — make sure
  `TraceTable.tsx` keeps that label format.

## Phase 3 fix pass — 2026-06-04

Code-quality review findings landed in this pass.

### Important

- **`findRetryAttempts` mis-numbered attempts.** The original code passed
  `retry.attempt` through as the user-visible attempt index, so an AMIE
  retry-attempt-1 span rendered as "Attempt 1" alongside the original root
  (also "Attempt 1"). Per spec §11.2, `retry.attempt` is the retry counter
  (0-based for the first retry on success, 1 for the second, etc.) — the
  user-visible attempt is `counter + 1`. Fixed by:
  - Original root → `attemptNumber: 1`.
  - Each retry span → `attemptNumber: (explicit ?? implicitCounter) + 1`.
  - Sort returned `Attempt[]` ascending by `attemptNumber` so out-of-DB-
    order rows render in lifecycle order.
  - Inline 1-line comment notes the counter-to-index translation.
- **Orphaned-fixture test promised payload-gate but exercised source-gate.**
  Renamed the assertion to "disables Retry when source is not amie
  (orphaned fixture)" with a regex bound to the source message. Added a
  second test that synthesizes an AMIE-source trace with `root_event: null`
  by spreading the failed-amie fixture; that test asserts the "Retry
  requires the original payload..." copy specifically.
- **AttemptsStrip test tightened.** Replaced
  `getAllByText(/Attempt \d/).length >= 2` with exact-label assertions:
  `Attempt 1` and `Attempt 2` are both present, `Attempt 3` is not, and
  Attempt 2's `<li>` appears after Attempt 1's in DOM order.

### Dedup pass

- `STATUS_TO_BADGE` was duplicated across `TraceDetailDrawer.tsx`,
  `TraceOverviewTab.tsx`, and `TraceTable.tsx`. Moved to
  `src/features/tracing/types.ts` next to `TRACE_STATUS`; all three call
  sites now import the shared constant.
- `formatRelative` + `MIN_MS`/`HOUR_MS`/`DAY_MS` and `copyTraceId` were
  duplicated in `TraceOverviewTab.tsx` and `TraceTable.tsx`. Both hoisted
  into `src/features/tracing/utils.ts`. `copyTraceId` lazily imports
  `sonner` so utils.ts stays mock-free for test setups that don't render
  the toast surface.

### Other minors

- `PayloadJsonView.tsx` `data: unknown` → `data: object | Array<unknown>`
  (matches `react-json-view-lite`'s `Props.data`); call site in
  `TraceOverviewTab.tsx` already guards `typeof parsed === "object"`
  so the `as object` cast is gone.
- `PAYLOAD_PREVIEW_BYTES` → `PAYLOAD_PREVIEW_CHARS` (it's
  `json.length`, not bytes).
- `TraceListContainer.tsx` import block merged
  `{ TraceFilterStrip }` and `{ DEFAULT_FILTERS }` from the same module
  into one import. Dropped the redundant `error as Error | null` cast on
  `listQuery.error`.
- `TraceDetailDrawer.tsx:75` dropped the unreachable
  `error.message ?? "Failed to load trace"` fallback. TanStack v5 narrows
  `error` to `Error` inside the `error` branch, so `error.message` is
  defined.
- `closeDrawer` deep-link branch gained a 1-line comment explaining
  why filter state isn't preserved when closing from the deep-link route.
- `RetryButton` disabled trigger gained `title={gate.reason}` so the gate
  reason has a stable DOM mirror (better a11y fallback for hover-less
  AT + cleaner test assertions; the base-ui Tooltip mounts its content
  lazily on hover, which makes pure DOM queries flaky).

### Skipped (per review)

- Test-helper extraction for the `next/dynamic` mock — leave for now.
  Phase 4's Waterfall tab will add a fourth call site; hoist then.
- `setTimeout(r, 0)` brittleness in `TraceDetailDrawer.test.tsx`.
- Exported `*Props` types.

### Verification

- `pnpm typecheck && pnpm lint && pnpm test` →
  `Test Files 73 passed (73) / Tests 541 passed (541)`. +1 vs Phase 3
  baseline (the new AMIE-null-payload test).
- `pnpm test:e2e tests/admin-traces-detail.e2e.ts` → `5 passed (19.0s)`.
- `pnpm test:e2e tests/admin-traces-list.e2e.ts` → `2 passed (9.9s)`.

