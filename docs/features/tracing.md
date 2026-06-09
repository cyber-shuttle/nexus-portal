# Admin Tracing UI (`/admin/traces`)

Admin-only request-flow viewer for Custos. Surfaces every captured trace as a
filterable list with a 30-day trend, opens a side drawer with overview, span
waterfall, raw JSON, and linked audit-event tabs, and exposes a one-click
retry for failed flows.

> **Design reference:** the source-of-truth design spec — full pixel-level
> tokens, screen specs, status semantics, and the suggested build order —
> lives at [`../design/tracing/README.md`](../design/tracing/README.md).

## Routes

| Path | Purpose |
| --- | --- |
| `/admin/traces` | List page with filters, trend chart, paginated table |
| `/admin/traces/[traceId]` | Deep-link form. Renders the list page with the drawer pre-opened on the given trace. Equivalent to `/admin/traces?trace=<id>`. |

The drawer is URL-driven. `?trace=<id>` opens it, `?span=<id>` selects a span
inside the waterfall, `?tab=<overview|waterfall|raw|linked>` chooses the
active tab. URL state mutates through `useShallowSearchParams`
(`src/shared/hooks/useShallowSearchParams.ts`) so filter, drawer, and tab
transitions stay client-only without a server roundtrip.

## Access control

Gated by CASL: `can('read', 'Trace')` is required to load the route, and
`can('retry', 'Trace')` to invoke the retry mutation. The `admin` system role
holds both. Lacking the read ability surfaces a 403 through the shared
`PermissionGate` pattern (`src/app/(portal)/admin/traces/PermissionGate.tsx`).

The sidebar entry is hidden for users without the read ability.

## Feature folder

```
src/features/tracing/
  schemas.ts                 — Zod shapes for Trace, Span, Stats, AuditEvent
  types.ts                   — inferred types + status/kind integer-enum maps
  api.ts                     — listTraces, getTrace, getTraceStats, retryTrace,
                               getAuditEventsForTrace
  queries.ts                 — traceKeys factory + useTraces / useTrace /
                               useTraceStats / useAuditEventsForTrace /
                               useRetryTrace
  utils.ts                   — formatting, tree builders, error-rail helpers
  components/
    TraceListContainer.tsx   — top-level client container; owns URL state,
                               renders header, sticky failure banner,
                               filter strip, trend chart, table, pagination
    TraceFilterStrip.tsx     — status / source chips, window preset radios,
                               debounced search, "Failing >24h" chip
    TraceTrendChart.tsx      — Recharts stacked-area over 30d window
    TraceTable.tsx           — DataTable wrapper with row click → drawer
    TraceDetailDrawer.tsx    — side drawer; hosts the tab router
    TraceOverviewTab.tsx     — meta rows, root payload, attempts strip
    TraceTreeTab.tsx         — span waterfall + detail panel (default tab)
    TraceRawTab.tsx          — pretty-printed JSON + copy-trace-JSON
    TraceLinkedEntitiesTab.tsx — linked audit events table
    TraceSpanDetailPanel.tsx — span meta + attributes (right pane of Tree tab)
    TraceRetryModal.tsx      — retry confirmation with payload preview
    ViewTraceLink.tsx        — cross-feature deep-link primitive
    LastTraceProvider.tsx    — React context wrapping the X-Trace-Id singleton
```

## Backend contract

Defined in [`docs/backend-contracts/traces.md`](../backend-contracts/traces.md). Five endpoints:

- `GET /admin/traces` — list with status / source / time-window / search filters
- `GET /admin/traces/{traceId}` — full trace including span tree
- `GET /admin/traces/stats` — 30-day trend buckets (configurable window up to 365d)
- `POST /admin/traces/{traceId}/retry` — re-enqueue a failed trace
- `GET /admin/audit-events?trace_id=...` — audit-log rows that reference the trace

The Zod schemas are null-tolerant on `root_event`, `attributes`, `ended_at`,
`end_time`, and `status_message` (backend may omit these for in-flight or
orphaned traces). `parent_span_id` is `.optional()` only; the backend omits it
for root spans but never sends `null`.

## State management

- **Server data** — TanStack Query. Defaults: `staleTime: 30_000`,
  `gcTime: 300_000`, focus-refetch disabled. Mutations invalidate
  `traceKeys.detail(id)` on success.
- **URL state** — all filter, drawer, tab, and span selection state lives on
  the URL. Back/forward navigation is fully supported; refreshing any URL
  restores the same view.
- **X-Trace-Id capture** — `src/shared/api/last-trace-id.ts` is a singleton
  populated by `apiFetch` from every response's `X-Trace-Id` header.
  `useLastTraceId()` exposes the latest value. Used by `ViewTraceLink` and by
  toast notifications that link to the originating trace.

## Cross-feature deep links

`ViewTraceLink` (`src/features/tracing/components/ViewTraceLink.tsx`) is the
single sanctioned cross-feature import out of `features/tracing/`. Other
features render it on audit/event rows to navigate into the trace view:

```tsx
<ViewTraceLink traceId={row.trace_id} variant="icon" />
```

It renders nothing when `traceId` is null/empty or when the viewer lacks
`read Trace`. From any route other than `/admin/traces`, it `router.push`es;
from within `/admin/traces`, it `router.replace`s while preserving the
existing filter state.

The host event/audit-log rows must carry a `trace_id` field for the link to
appear. Schemas without `trace_id` (current state for `PacketEvent`,
`ComputeAllocationDiff`, `ComputeAllocationChangeRequest`) surface no link
until both sides are updated; this requires a backend wire-format change
before the link can be wired in those features.

## Retry flow

`TraceRetryModal` covers all six retry status codes from the backend
contract (202, 400, 404, 409, 422, 5xx). The modal shows the operation name,
source, attempt count, previous-failure count, and a lazy-loaded preview of
the original payload (`PayloadJsonView`, code-split via `next/dynamic`).
Default focus is on Cancel; the confirm CTA is destructive-styled. On 5xx
the toast surfaces a "Retry the retry" action that re-invokes the same
mutation.

## Waterfall

`TraceTreeTab` (the default tab) is a two-column split: span tree on the
left, detail panel on the right. The tree is built by `buildTree` in
`utils.ts`, with retry-root spans lifted to top-level siblings. Visible spans
are windowed at 200 rows with a "Load more" affordance up to a hard cap of
5000; excess spans surface as "+N more not shown".

Keyboard navigation:

| Key | Action |
| --- | --- |
| ↑ / ↓ | Move selection across the visible flat list |
| → | Expand the focused span / open the detail panel |
| ← | Collapse / close the detail panel |
| `n` / `p` | Jump to next / previous error span |
| `Cmd`+`C` / `Ctrl`+`C` | Copy the focused span's ID |

An error-rail strip along the left edge highlights every error span on a
single overview bar; clicking a marker selects and scrolls to that span.
Selection scrolls via explicit `scrollTop` math rather than `scrollIntoView`
so the rail stays in sync.

## Accessibility

- axe-core sweeps run inside the list, detail, and tab e2e suites. No
  serious or critical violations.
- All status color tokens clear WCAG AA (4.5:1) against their paired
  backgrounds. Amber is tightest at 4.51:1.
- Every interactive control has an accessible name (visible text or
  `aria-label`).
- Waterfall is fully keyboard-navigable; reduced-motion is respected for
  the in-progress pulse and the rail scroll animation.

## Testing

| Layer | Location | Coverage |
| --- | --- | --- |
| Unit (Vitest) | `src/features/tracing/__tests__/` | Schemas, query keys, API client, utils, every component |
| Mock handlers | `src/mocks/handlers/__tests__/traces.test.ts` | Every endpoint × every status code in the retry matrix, limit / offset / window guards |
| E2E (Playwright) | `tests/admin-traces-*.e2e.ts`, `tests/cross-link-view-trace.e2e.ts` | List + drawer + tabs + retry + cross-link flows, plus axe sweeps |

Run the focused suite:

```bash
pnpm vitest run src/features/tracing
pnpm playwright test tests/admin-traces-list.e2e.ts
```

## Live vs. mocked

Out of the box, MSW intercepts every `/api/v1/admin/traces*` and
`/api/v1/admin/audit-events*` call in the browser. To hit a real backend,
add `traces*` and `audit-events` to `PORTAL_LIVE_ENDPOINTS` in
`.env.local` and ensure the backend exposes the endpoints documented in the
[contract](../backend-contracts/traces.md).
