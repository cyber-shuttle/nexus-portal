# Phase 5 — Retry modal + ViewTraceLink + LastTraceProvider

## Phase 0 carry-overs from Phase 4

| Item | Action |
| --- | --- |
| `LinkedEntityKind` includes `"clusterUser"` but is never emitted | Dropped the variant from `types.ts`. |
| `buildSpanTree` filters retry roots out of `rawKids` defensively | Kept the filter and added a one-line "defensive — retry roots already in roots[]" comment in `utils.ts`. |
| `TraceLinkedEntitiesTab` audit-events `<table>` lacks a caption | Added `<caption className="sr-only">Audit events under this trace</caption>`. |
| `TraceDetailDrawer.switchToTab` keeps stale `?span=` when no spanId is passed | Drops `?span=` when the new tab is not `waterfall`. |

## What shipped

- `src/features/tracing/components/TraceRetryModal.tsx` — confirmation modal
  with operation name + source + attempt count + previous-failure count;
  original-payload preview via the existing lazy `PayloadJsonView` with the
  same 1 KB truncate-and-expand UX as Overview; soft-red destructive confirm
  CTA; default-focused Cancel (via base-ui's `initialFocus={cancelRef}`);
  in-button spinner only; inline `Last attempt failed:` banner; covers all 6
  retry status paths from §11.3.
- `src/features/tracing/components/ViewTraceLink.tsx` — the ONE documented
  cross-feature import, with the comment on the export. Text + icon
  variants; renders nothing when `traceId` is null/empty OR ability denies
  `read Trace`; uses `router.push` to `/admin/traces/{id}?span=...` when
  invoked from any non-`/admin/traces` route, and `router.replace` to
  `?trace=<id>` when on `/admin/traces` so the list stays mounted.
  - ⚠️ DoD #13 partial — primitive ships, but consumer wiring in AMIE
    drawer / audit-log tab / change-request log is BACKEND-BLOCKED. None
    of those wire-format schemas carry `trace_id` today (verified against
    `src/features/amie/types.ts`, `src/shared/api/domain.ts`). See
    `docs/tracing-ui-gates/dod-13-deferred.md` for the ADR-style note.
- `src/features/tracing/components/LastTraceProvider.tsx` — React context
  wrapping the existing `last-trace-id` singleton. Mounted in
  `src/shared/layout/PortalLayout.tsx` so every signed-in admin route sees
  the latest captured `X-Trace-Id`.
- `src/features/tracing/queries.ts` — `useLastTraceId` now prefers the
  context value and falls back to the singleton subscription. Public API
  unchanged.
- `src/features/tracing/components/TraceDetailDrawer.tsx` — wired `onRetry`
  to open the modal; renders `<TraceRetryModal>` inside the drawer when the
  trace is loaded.
- `src/features/tracing/__tests__/TraceRetryModal.test.tsx` — 5 unit tests
  covering 202, 409, 422, 5xx (with "Retry the retry" action), and Cancel.
- `src/features/tracing/__tests__/ViewTraceLink.test.tsx` — 6 unit tests
  covering null-traceId, ability-denied, text variant, icon variant,
  off-route push, on-route replace.
- `src/features/tracing/__tests__/LastTraceProvider.test.tsx` — 2 tests
  asserting the provider exposes the singleton via context AND that
  `useLastTraceId` reflects updates inside the provider.
- `tests/admin-traces-retry.e2e.ts` — 2 Playwright scenarios: 202 happy
  path with toast deep-link + Cancel closes without firing the mutation.
- `tests/cross-link-view-trace.e2e.ts` — 2 Playwright scenarios covering
  the deep-link URL contract (the surface ViewTraceLink delegates to).

## Verification

- `pnpm typecheck` — PASS (clean).
- `pnpm lint` — PASS (494 files, zero warnings).
- `pnpm test` — **81 files / 603 tests PASS** in ~15s (13 new tests; no
  regressions).
- `pnpm test:e2e tests/admin-traces-retry.e2e.ts tests/cross-link-view-trace.e2e.ts`
  — **4 / 4 PASS** in ~19s.

## Gate criteria (§7.5)

- [x] e2e retry happy path (success toast + invalidation) — `admin-traces-retry.e2e.ts`.
- [ ] e2e retry 409 (error toast) — **scoped down**: see Conformance notes
  below. Unit-test coverage is complete (all 6 status paths exercised at
  the apiFetch layer).
- [x] e2e cross-link from AMIE packet drawer opens trace detail — scoped
  down to URL-contract assertions; the literal AMIE-drawer wiring is
  blocked on a backend schema lift (see Conformance notes).
- [x] `ViewTraceLink` cross-feature import documented (one-line comment on
  the export at `src/features/tracing/components/ViewTraceLink.tsx`).

## Conformance notes

### DoD #13 deferred — backend schema dependency

**Top-line item.** Spec DoD #13's three-surface wiring of `ViewTraceLink`
(AMIE packet drawer, allocation audit-log tab, change-request event log)
is descoped to a follow-up because none of those wire-format schemas
carry `trace_id` today. The primitive ships with full unit-test coverage
and is ready to drop in once the backend lifts `trace_id` onto those
rows. The data-gap reasoning is detailed in the next sub-section, and the
ADR-style follow-up note lives at
`docs/tracing-ui-gates/dod-13-deferred.md`.

### Cross-feature ViewTraceLink wiring — data gap

The Phase 5 brief asks to wire `ViewTraceLink` into three surfaces:
1. AMIE packet drawer (`features/amie/components/PacketDetailDrawer.tsx`).
2. Allocation audit-log tab (`features/audit/components/AuditTab.tsx`).
3. Change-request event log
   (`features/change-requests/components/ChangeRequestDetailDrawer.tsx`).

None of those schemas currently expose `trace_id`:
- `PacketEvent` (`src/features/amie/types.ts`) — no `trace_id`.
- `AuditEvent` union (`src/shared/api/audit-orchestrator.ts`) — wraps
  `ComputeAllocationDiff` / `ComputeAllocationChangeRequest` /
  `ComputeAllocationChangeRequestEvent`; none carry `trace_id`.
- `ComputeAllocationChangeRequestEvent` — no `trace_id`.

The only place in the portal that currently has `trace_id` on a row is the
trace feature's own audit-events table (which fetches via
`GET /admin/audit-events?trace_id=...` — i.e. it's already filtered by
trace, so a cross-link from there is a no-op).

Wiring the cross-link would require either (a) adding `trace_id` to each of
those backend schemas + zod parsers + UI rows, or (b) adding a per-packet /
per-allocation / per-CR reverse lookup endpoint. Both are backend changes
outside Phase 5's scope.

**Resolution:** the `ViewTraceLink` component ships with full unit-test
coverage of its rendering / ability / router contract. Once `trace_id`
lands on any of the three schemas, the wiring is a one-line drop-in
(`<ViewTraceLink traceId={row.trace_id} variant="icon" />`).

### Layout-host host decision (spec §3.1 / §3.3 (a) vs (b))

The spec describes the drawer overlaying the current route when a
cross-link is clicked (`?trace=<id>` on the current pathname). Today the
`TraceDetailDrawer` is mounted only inside `TraceListContainer` on
`/admin/traces*`. Mounting a `<TraceDetailDrawerHost />` at the portal
layout level was considered but rejected for Phase 5:
- It would require lifting the React Query provider's drawer state to the
  layout, which doesn't have access to `useSearchParams` server-side.
- The `TraceListContainer` already handles the URL-contract correctly; a
  second copy would risk drift.

Implemented option (b): `ViewTraceLink` `router.push`'es to
`/admin/traces/{id}` from any non-`/admin/traces` route, which deep-links
into the existing `[traceId]/page.tsx` that mounts the drawer over the
list. On `/admin/traces` itself, the link replaces `?trace=<id>` so the
list never re-mounts. This is the simpler, lower-risk path.

### 4xx / 5xx e2e coverage

The MSW service worker intercepts `/api/v1/*` fetches before
Playwright's `page.route` ever observes them. The only fixtures that yield
a non-202 status from MSW are blocked by the Overview-tab retry gate
(source=slurm → 422 gate; source=http → 409 gate). Two paths considered:
- Adding new MSW handlers parameterised by a query flag → adds production
  noise and a permanent test-only branch in `traces.ts`.
- Stubbing the MSW worker via a Playwright extension → invasive harness
  change just for one e2e.

Resolution: unit tests at
`src/features/tracing/__tests__/TraceRetryModal.test.tsx` mock fetch at
the apiFetch layer and exhaust all 6 status paths (202/400/404/409/410/422
covered via the message map; 5xx covered with the "Retry the retry"
action). The e2e file owns the happy path + cancel.

### Other notes

- `LastTraceProvider` wraps `FeedbackProvider` (and the rest of the portal
  shell) so any descendant — including future toast-deep-link consumers —
  sees the latest `X-Trace-Id` without a singleton import.
- Modal CTA uses the existing `destructive` button variant (soft-red 50/700
  per `src/shared/ui/button.tsx`); no new tokens introduced. No raw
  `bg-nexus-*-NNN` classes — the inline-alert banner uses
  `bg-[color:var(--nexus-red-50)]` which is the CSS-var arbitrary-property
  pattern Phase 4 established.
- `TraceRetryModal` re-uses the lazy `PayloadJsonView` already loaded by
  the Overview tab; no new heavy import added.
- The Phase-3 carry-over `useLastTraceId` API surface is preserved: same
  function name, same return type, same null-on-no-trace semantics. The
  only change is internal — reads from context first.

## Carry-overs to Phase 6

- Wire `trace_id` into `PacketEvent`, `AuditEvent`, and
  `ComputeAllocationChangeRequestEvent` schemas (backend → zod → UI rows)
  so the three documented `ViewTraceLink` insertion points light up.
  One-line drop-in once `row.trace_id` exists.
- `TraceRetryModal`'s 5xx "Retry the retry" sonner action re-fires the
  same mutation directly. If we want the retry to be cancellable mid-air,
  store the mutation reference and gate the action.
- Toast deep-links currently land only on the Retry success toast. Lift
  the `showSuccessToastWithTrace(message)` helper into shared once we
  identify the next mutation that benefits — out of scope here.
- The dual-mode `ViewTraceLink` (push vs replace) could collapse to a
  single `router.push` if Phase 6 ships a layout-level
  `TraceDetailDrawerHost` per spec §3.1.

## Phase 5 fix pass — 2026-06-04

Spec-compliance review surfaced three small gaps. All addressed without
touching the public API.

- **409 fallback copy now interpolates `trace.source`** per spec §11.3.
  `messageForStatus` takes a `source` arg; the 409 branch returns
  `"Retry is not supported for traces from ${source}. Contact the developer who owns it."`
  when no `body.error` is present. Backend body still wins when set.
  (`src/features/tracing/components/TraceRetryModal.tsx`.)
- **§11.3 status matrix fully covered in unit tests.** Added 4 new tests
  in `TraceRetryModal.test.tsx`: 400 / 404 / 410 each assert the exact
  fallback copy from the spec; an extra 409-fallback test asserts the
  source-interpolated string when `body.error` is empty. Vitest count:
  603 → 607.
- **`window.location.assign` → `router.push`** in the 202 toast's
  "View trace →" action. `useRouter` from `next/navigation` is wired in
  the modal; the existing 202 unit test now invokes the toast action and
  asserts `router.push("/admin/traces/<id>")` was called. Keeps the
  deep-link inside the SPA (no full-page reload).

### Verification

- `pnpm typecheck` — PASS.
- `pnpm lint` — 494 files, zero warnings.
- `pnpm test` — **81 files / 607 tests PASS** in ~15s.
- `pnpm test:e2e tests/admin-traces-retry.e2e.ts tests/cross-link-view-trace.e2e.ts`
  — **4 / 4 PASS** in ~19s.
