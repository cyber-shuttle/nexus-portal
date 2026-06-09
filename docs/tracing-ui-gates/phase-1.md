# Phase 1 — Scaffold + MSW + contract doc

## What shipped

- Route group `src/app/(portal)/admin/traces/`:
  - `layout.tsx` — server wrapper around the client `TracePermissionGate`.
  - `PermissionGate.tsx` — CASL early-return 403 (mirrors AMIE's gate, swapped to `Trace` subject).
  - `page.tsx` — list view stub rendering `<TraceListContainer />`.
  - `[traceId]/page.tsx` — deep-link target passing `initialTraceId` to the same container.
- `src/features/tracing/` feature folder:
  - `api.ts` — `listTraces`, `getTrace`, `getTraceStats`, `retryTrace`, `getAuditEventsForTrace`. Each calls `apiFetch` against `/admin/traces*` and parses through its Zod schema before returning.
  - `queries.ts` — `traceKeys` namespace exactly matching spec §3.2, plus `useTraces`, `useTrace`, `useTraceStats`, `useAuditEventsForTrace`, and `useRetryTrace`. Defaults: `staleTime: 30_000`, `gcTime: 300_000`, focus-refetch disabled. Mutation invalidates `traceKeys.detail(id)` on success.
  - `schemas.ts` — Zod shapes mirroring `pkg/models/trace.go`. Null-tolerant on `root_event`, `attributes`, `ended_at`, `end_time`, `status_message`; `parent_span_id` is `.optional()` only (backend omits, never nulls) per §11.1/§11.2.
  - `types.ts` — inferred types plus `TRACE_STATUS` and `SPAN_KIND` integer-enum maps (§11.7).
  - `utils.ts` — `shortHex`, `formatDurationMs`, `durationBetween`, `formatAbsoluteUtc`.
  - `components/TraceListContainer.tsx` — `<PlaceholderPage phase={2} ... />` stub.
  - `__fixtures__/` — `traces.list.fixture.json` (5 rows, mix of statuses + sources), `trace.amie.success.fixture.json` (10 spans, no errors), `trace.amie.failed.fixture.json` (10 spans incl. a `retry:*` synthetic-parent span per §11.2), `trace.http.fixture.json`, `trace.orphaned.fixture.json` (status=3, no `ended_at`, omitted `root_event`), `stats.fixture.json` (39 buckets across 30 days), `audit-events.fixture.json` (core + amie rows linked to the failed trace).
  - `__tests__/` — `schemas.test.ts`, `query-keys.test.ts`, `api.test.ts`.
- CASL ability extension at `src/shared/casl/abilities.ts` — `can('read', 'Trace')` + `can('retry', 'Trace')` added to `applyAdminRules`. Subjects in this codebase are unconstrained strings on `MongoAbility`, so no separate union to widen.
- Sidebar entry at `src/shared/layout/navConfig.ts` — `"Tracing"` under `admin` group, `Activity` icon, gated by `{ action: 'read', subject: 'Trace' }`. The existing `Sidebar.tsx` filter (`portalNav.filter(... ability.can(...))`) hides the entry when the user lacks the ability.
- Backend contract doc at `docs/backend-contracts/traces.md` — 5 endpoints sketched OpenAPI-style with shapes from `pkg/models/trace.go` and the §11.3 status matrix.
- MSW handlers at `src/mocks/handlers/traces.ts` + aggregator update in `src/mocks/handlers/index.ts`. Limit clamps at 200, offset rejects beyond 1_000_000, stats `window` rejects beyond 365d. Retry returns 202 by default, 422 for the orphaned fixture, 409 for the http fixture, 400 for malformed hex.
- `apiFetch` X-Trace-Id capture (§11.4) — `src/shared/api/last-trace-id.ts` singleton (get/record/subscribe), wired into `src/shared/api/client.ts`. `useLastTraceId()` hook exposed from `features/tracing/queries.ts`. Phase 5 implementer can adapt this into a context + toast deep-link.
- Unit test for X-Trace-Id capture at `src/shared/api/__tests__/last-trace-id.test.ts`.
- Direct-resolver test of every MSW handler at `src/mocks/handlers/__tests__/traces.test.ts` (13 cases covering happy paths + every status code in the retry matrix + limit clamping + offset bound + window bound).

## Verification

- `pnpm typecheck` — clean (zero diagnostics).
- `pnpm lint` — clean (459 files checked, 0 errors).
- `pnpm test` (Vitest) — `Test Files 66 passed (66) / Tests 495 passed (495)`. Phase-1 additions: 13 handler tests + 16 schema tests + 5 query-key tests + 9 api tests + 2 X-Trace-Id tests.

### MSW dev verification

Booted `pnpm dev` (env: `NEXT_PUBLIC_PORTAL_USE_MSW=true` from `.env.local`).
The server starts and routes resolve.

**Important caveat surfaced during this gate:** in nexus-portal the MSW
worker only runs **in the browser** (`src/shared/providers/MswProvider.tsx`
boots `setupWorker` after hydration). The Next.js server-side proxy at
`src/app/api/v1/[...path]/route.ts` forwards directly to
`CORE_API_BASE_URL` (defaulted to `http://localhost:8080`) without going
through MSW node. `src/instrumentation.ts` does start an MSW node interceptor,
but it's only consulted by server-side fetches inside that Next process; in
practice, a `curl http://127.0.0.1:3000/api/v1/admin/...` from a terminal
flows through the proxy to whatever upstream is running on 8080 — not MSW.

Browser-side MSW interception is exercised when the React tree fetches via
`apiFetch`, which is the path Phase 2+ pages will use. To cover the gate
intent right now, the handler resolvers are invoked directly in
`src/mocks/handlers/__tests__/traces.test.ts` and all five endpoints return
the documented shapes + status codes from the fixtures.

Browser smoke (visiting `/admin/traces` while signed in as admin) lands on
the Phase-2 placeholder; full UI consumption arrives next phase.

## Gate criteria status (per spec §7.1)

- [x] `pnpm typecheck` clean.
- [x] `pnpm test` green (495/495).
- [x] MSW responds to all 5 endpoints (verified via direct resolver tests; browser-side worker is registered through the existing `MswProvider`).
- [x] Folder convention matches spec §3.5 (`api.ts`, `queries.ts`, `schemas.ts`, `types.ts`, `utils.ts`, `components/`, `__fixtures__/`, `__tests__/`).
- [x] No cross-feature imports — `features/tracing` only imports from `@shared/api/*`, `@/shared/ui/*`, and `@tanstack/react-query` / `zod` / `react`. `ViewTraceLink` is intentionally deferred to Phase 5.

## Conformance notes (per spec §6)

- Status `z.unknown().nullish()` is used for `root_event` and `attributes` so both `null` and omitted fields parse. `parent_span_id` is `.optional()` only — the schema explicitly rejects literal `null` (asserted in `schemas.test.ts`).
- `useEffect` is used only for the `useLastTraceId` hook to subscribe to the singleton — not for data fetching. Server data flows exclusively through TanStack Query.
- No raw `bg-nexus-*-NNN` classes in any new file. Surfaces reuse `text-muted-foreground`, `font-display`, `font-mono`. The placeholder component delegates to the shared `PlaceholderPage` primitive.
- CASL subject is the string literal `'Trace'`. The abilities builder uses `MongoAbility` (string-subject union is open), so no module-level union to extend; left a brief inline comment-free addition near the existing admin grants.
- `MswProvider` is unchanged; the worker auto-picks up `tracesHandlers` through the aggregator.

## Carry-overs to Phase 2

- The placeholder container uses `PlaceholderPage` with `phase={2}` — Phase 2 replaces it wholesale with the real list page; no migration needed.
- Backend uses `started_at`/`ended_at` field names (matches `pkg/models/trace.go`); the original spec sketch in §11 used `started_at`/`ended_at` as well. Phase 2 filter-strip URL params should align with §11.5 / §11.6 (source enum, status-as-int).
- `useLastTraceId` is a minimal singleton subscriber. Phase 5 should wrap it in a context provider so toast deep-links can read it during SSR/early mount without a flash.
- The MSW handler for `GET /admin/traces` does in-memory filtering and pagination of the 5-row fixture; if Phase 2 wants to exercise larger pagination scenarios, expand the fixture (or generate rows in the handler).
- Dev-server MSW (`pnpm dev` + `NEXT_PUBLIC_PORTAL_USE_MSW=true`) only intercepts browser-originated fetches. Anyone curling the proxy directly bypasses MSW. Phase 6 should call this out in the README before clean-slate verification.

## Phase 1 fix pass — 2026-06-03

- `schemas.ts`: opened `traceSourceSchema` to `enum(...).or(z.string())` so unknown sources widen-through instead of throwing (§11.6); comment now matches behavior.
- `schemas.ts`: dropped the hard `.max(3)` / `.max(4)` caps on `status`/`kind`; codes are now `int().nonnegative()` so a new backend code parses cleanly.
- `types.ts`: added `getTraceStatusInfo(status)` and `getSpanKindLabel(kind)` helpers with `Unknown` / `unknown` fallback; `TRACE_STATUS` and `SPAN_KIND` are now `Record<number, ...>` lookups; `TraceSource` widened to the union-plus-string-branded type.
- `queries.ts`: `useLastTraceId` re-reads `getLastTraceId()` inside its effect to close the race between the lazy initializer and the subscribe call.
- `queries.ts`: `useRetryTrace.onSuccess` invalidates `traceKeys.all` so list rows + stats buckets refetch alongside the detail query.
- `api.ts`: added `RetryApiError extends ApiError` that carries the parsed `{ error }` envelope; `retryTrace` validates non-2xx bodies through `retryErrorEnvelopeSchema` and rethrows the typed error (falls back to bare `ApiError` for non-envelope bodies like HTML 500s).
- `api.ts`: `qs()` now sorts the `source` and `status` arrays before serializing, so equivalent filter sets produce identical URLs and TanStack cache keys.
- `queries.ts`: collapsed the three-line `last-trace-id` import to one line.
- `__tests__/api.test.ts`: tightened the URL match to `/\/admin\/traces\?/`; added a "sorts multi-value filters" test; replaced the 409 ApiError test with a typed `RetryApiError` assertion plus a non-envelope fallback test.
- `__tests__/queries.test.tsx` (new): renderHook tests for `useLastTraceId` (reads pre-mount value, reacts to post-mount recordings) and `useRetryTrace` (invalidates `traceKeys.all` on 202).
- `pnpm typecheck && pnpm lint && pnpm test`: `Test Files 67 passed (67) / Tests 500 passed (500)` (was 495; +5 new tests, zero regressions).
