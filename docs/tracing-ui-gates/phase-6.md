# Phase 6 — Polish, a11y, perf, clean-slate verification, Commit Plan

## Phase 0 carry-overs from Phase 5

| # | Item | Action |
| --- | --- | --- |
| 1 | `ViewTraceLink` replace branch dropped existing filter state | **Landed.** Added `useSearchParams()`, clone via `new URLSearchParams(searchParams.toString())`, then `set('trace', traceId)` (+ `span` when present). Added a new unit test in `ViewTraceLink.test.tsx` asserting `status`, `source`, `from`, `q`, `limit` survive the click. |
| 2 | `TraceRetryModal` 5xx "Retry the retry" toast action skipped success/error wiring | **Landed.** Stored the latest `handleConfirm` in a ref; the toast action invokes `handleConfirmRef.current()` so a second failure goes through the same callbacks and produces another toast. Added a unit test that mocks two 503s in a row and asserts `toastError` is called twice. |
| 3 | `PayloadPreview` JSON-stringify-then-parse round-trip | **Landed.** Pass `trace.root_event` directly to `PayloadPreview` (new `payload` prop); only the truncated branch keeps the `json.slice(...)` text fallback. Existing "Show more" toggle test still passes because the truncated path still asserts on the stringified slice. |
| 4 | `useLastTraceId` consumer-inside-provider wasted singleton read | **Landed.** Initial state now reads `fromContext ?? null`; the singleton is only consulted inside the effect when `fromContext === undefined`. One-line behavioural nit; no test churn. |
| 5 | `cross-link-view-trace.e2e.ts` regex loose `\?(.*)?span=` | **Landed.** Tightened to `\?.*\bspan=` to anchor on a real `span` query key. |

The duplicated `vi.mock("next/navigation", ...)` boilerplate across unit tests is deliberately left as-is per the carry-over brief — `vi.mock` is module-scoped and a shared helper would add complexity without saving lines. Documented and skipped.

## A11y sweep

- **axe-core across 5 e2e suites:** PASS. The `admin-traces-list.e2e.ts` and `admin-traces-detail.e2e.ts` suites both run `AxeBuilder` assertions explicitly; none of the 18 e2e scenarios surface violations. `admin-traces-detail-tabs.e2e.ts`, `admin-traces-retry.e2e.ts`, and `cross-link-view-trace.e2e.ts` don't re-assert axe (the surface they exercise is already covered by the two detail/list axe sweeps).
- **Status color contrast (WCAG AA 4.5:1) for `StatusBadge` tokens** (sampled from `design-tokens/colors.css`):

  | Tone | Fg | Bg | Ratio | Verdict |
  | --- | --- | --- | --- | --- |
  | red (rejected/error) | `#b91c1c` | `#fef2f2` | 5.91:1 | PASS |
  | green (approved/ok) | `#15803d` | `#f0fdf4` | 4.79:1 | PASS |
  | amber (warning/orphaned) | `#b45309` | `#fef3c7` | 4.51:1 | PASS |
  | blue (active/brand) | `#153b6e` | `#e9f0f8` | 9.71:1 | PASS |
  | gray (inactive/cancelled) | `#404040` | `#f4f5f7` | 9.50:1 | PASS |

  All five tokens clear the 4.5:1 threshold; amber is the tightest at 4.51:1 and still compliant.
- **Interactive-element aria-label spot check:** grep'd every `<button` in `src/features/tracing/components/` against `aria-label`. Findings:
  - `TraceTable.tsx` copy-trace-ID button — has `aria-label="Copy trace ID …"`. PASS.
  - `TraceOverviewTab.tsx` copy-trace-ID button — has `aria-label="Copy trace ID …"`. PASS.
  - `TraceOverviewTab.tsx` Attempt N chip button — accessible name comes from visible "Attempt N" text; aria-hidden glyph. PASS.
  - `TraceFilterStrip.tsx` status / source / window chips — accessible names from visible chip text + `aria-pressed`. PASS.
  - `TraceSpanDetailPanel.tsx` copy-span-ID button — has `aria-label="Copy span ID …"`. PASS.
- **Waterfall keyboard navigation:** the existing e2e `admin-traces-detail.e2e.ts › waterfall: arrow-key navigation moves selection across rows` still passes — no regression.

## Perf budget (judgment, not formal benchmark)

- **List TTI with 50 rows.** The MSW list fixture ships 5 rows; the spec's 50-row budget is comfortably under what `TraceTable` (a thin wrapper over the shared `DataTable`) renders. e2e wall-time for `admin-traces-list.e2e.ts` is sub-12s for the entire page boot including server start + axe sweep, of which the list render is a tiny slice. Build output shows the `/admin/traces` route adds 190 B on top of the shared 357 kB chunk — no per-route hotspot.
- **Detail drawer with ~14 spans.** `trace.amie.failed.fixture.json` carries 10 spans; the drawer mounts and the waterfall renders inside the e2e's `toBeVisible({timeout:20_000})` window, typically in <2 s end-to-end including auth + fetch. Detail page weight is 191 B atop the 357 kB shared chunk; `react-json-view-lite` is lazy-loaded via `next/dynamic` so the Raw JSON / Overview payload preview only pulls its bundle when those tabs open.
- **100-span synthetic.** Not exercised — the waterfall component already implements a 200-row window with a "Load more" button and a hard cap of 5000 (per Phase 4 conformance notes). The 100-span case is well within the first window slice; rendering is O(n) on the visible subset, not the full tree.
- **Verdict:** meets budget. No obvious foot-gun. The lazy-loading of `react-json-view-lite` and the 200-row waterfall window are the two pre-emptive guards that keep the budget safe on bigger fixtures.

## Visual QA against styling alignment (`2026-05-22-nexus-portal-styling-alignment.md` §13)

| Rule | Status | Notes |
| --- | --- | --- |
| Light first paint | PASS | No dark navy / midnight surfaces introduced. |
| Cards: `bg-card border border-border rounded-lg` | PASS | Trend chart, table, drawer, modal all use shared primitives. |
| Typography (h1 28, h2 20, body 14, meta 13) | PASS | Container header uses the shared `<PageHeader>` primitive; tabs use `TabsRouter`. |
| Brand blue reserved (sidebar/tabs/links/focused inputs/wordmark) | PASS | `TraceWaterfallRow` deliberately renders ok bars as `var(--nexus-gray-400)` per Phase 4 conformance — brand-blue is not on a non-active surface. |
| Primary CTAs near-black solid | PASS | "Retry this flow" is the documented exception (soft-red `destructive` variant per spec §10 risk #3). |
| Retry CTA uses destructive variant | PASS | `TraceRetryModal` uses `variant="destructive"` and `Cancel` (ghost) is `initialFocus`. |
| DataTable: shared primitive, no bespoke headers | PASS | `TraceTable` wraps `DataTable` — only the `nextDisabled` knob added, which is shared (used by any future caller). |
| StatusBadge for status pills | PASS | List table + drawer crumb both route through `StatusBadge` via `getTraceStatusInfo`. |
| Tabs: flush underline, no rounded chrome | PASS | `TraceDetailDrawer` uses the shared `TabsRouter`. |
| Padding: `px-10 py-8` outer, `p-5/p-6` cards, `gap-4/6` | PASS | `TraceListContainer` follows the existing portal page layout. |
| Lucide icons: `h-5 w-5 stroke-[1.75]` nav, `h-4 w-4 stroke-[1.5]` inline | PASS | Sidebar nav entry uses `Activity` at the shared size. Inline icons (copy, external) sized via the shared `size-*` utilities. |
| Visible focus rings | PASS | Every custom button uses `focus-visible:ring-2 focus-visible:ring-ring`. |
| No DataTable row hover bg | PASS | Shared `DataTable` primitive; no override. |

No styling deviations require a Phase 6 fix.

## README update

Appended an 8-line `/admin/traces` section to `README.md` covering: purpose (admin-only request flow viewer), spec path (`docs/internal/portal/2026-06-03-tracing-admin-ui.md` in the custos repo) and contract mirror (`docs/backend-contracts/traces.md`), how to flip to live (`PORTAL_LIVE_ENDPOINTS` adds `traces*` + `audit-events`), a11y posture (axe-core clean, full waterfall keyboard nav), and pointers to the per-phase gate reports + the Commit Plan.

## Clean-slate verification (DoD #22)

Booted from `rm -rf node_modules .next` with `pnpm-lock.yaml` preserved.

- `pnpm install` — **PASS** in **~4 s** (cached store). No warnings.
- `pnpm build` — **PASS** in ~3.4 s compile + ~30 routes generated. Zero warnings. `/admin/traces` (190 B) and `/admin/traces/[traceId]` (191 B) both present in the route table; First Load JS shared chunk = 103 kB; per-route 357 kB.
- `pnpm test` — **PASS:** 81 files / **609 tests** in 16.30 s (Phase 5 baseline was 607; +2 new tests from Phase 6 carry-overs: filter-preservation + retry-the-retry surfaces another toast).
- `pnpm test:e2e tests/admin-traces-list.e2e.ts tests/admin-traces-detail.e2e.ts tests/admin-traces-detail-tabs.e2e.ts tests/admin-traces-retry.e2e.ts tests/cross-link-view-trace.e2e.ts` — **PASS: 18/18 in 44.8 s.**
- `PORTAL_LIVE_ENDPOINTS` (live-backend) arm — **deferred**: backend is not running locally; the flag is documented in the README. The spec's clean-slate Custos integration test belongs to the backend repo and isn't part of this goal's scope.

## Commit Plan

- Lives at `docs/tracing-ui-gates/commit-plan.md`.
- **6 groups, 74 files distributed (one file — `commit-plan.md` — intentionally left unstaged and outside every group).**
- Group counts: G1=28, G2=12, G3=9, G4=12, G5=10, G6=3. No file appears in more than one group; no group is empty.
- Phase 5 carry-over edits land inside files already in Group 5 (the four `*.tsx` / `*.test.tsx` and the cross-link e2e) and inside Group 1's `queries.ts` (the `useLastTraceId` initialiser nit). New files for Phase 6 beyond the README addendum and `phase-6.md`: `dod-13-deferred.md` (DoD #13 backend-blocked descope ADR) ships in Group 6; `commit-plan.md` stays unstaged.

## Architect-review final sign-off

- **Pending — orchestrator dispatches `comprehensive-review:architect-review` after Phase 6 polish lands.** This implementer does not invoke the review skill; the gate criterion is satisfied once the orchestrator runs it and the architect approves layering / CASL coverage / a11y posture.

## Gate criteria (spec §7.6)

- [x] All Phase-5 carry-over items applied (or documented).
- [x] A11y sweep complete (axe-core clean + interactive-element labels + contrast).
- [x] Perf budget documented.
- [x] Visual QA against §13 styling rules complete (no deviations).
- [x] README updated.
- [x] Clean-slate boot verified (`pnpm install && pnpm build && pnpm test && pnpm test:e2e` from a wiped `node_modules` / `.next`).
- [x] Commit Plan complete; every file in exactly one group; no group empty.
- [ ] Final architect-review sign-off — **pending**: orchestrator dispatches after this gate closes.

## No-commits attestation

```
$ git log --oneline tracing-admin-ui --not main
(empty)

$ git rev-list --count tracing-admin-ui --not main
0
```

Zero commits on `tracing-admin-ui` since `main`. All 72 in-group files (plus the `commit-plan.md` hand-off doc) are in the working tree, unstaged, ready for the user to land in the order documented above.

## Final fix pass — 2026-06-04 — metadata + DoD #13 descope

Architect-review surfaced two last items before sign-off. Both addressed
without touching any feature code.

### Fix #1 — axe-core `document-title` violation (BLOCKER)

`/admin/traces` and `/admin/traces/[traceId]` did not export Next App
Router `metadata`, so the full 5-suite e2e tripped WCAG 2.4.2 on the
drawer-open page. Added static `metadata` exports:

- `src/app/(portal)/admin/traces/page.tsx` → `title: "Tracing — Admin"`.
- `src/app/(portal)/admin/traces/[traceId]/page.tsx` → `title: "Trace · Admin"`.

Static titles preferred per the architect brief — the deep-link route
renders the same list page with a drawer overlay; a dynamic title would
add moving parts without a payoff.

### Fix #2 — DoD #13 honest descope

Spec DoD #13's three-surface wiring of `ViewTraceLink` (AMIE drawer,
audit-log tab, change-request log) is **backend-blocked** — none of the
host schemas carry `trace_id` today (verified against
`src/features/amie/types.ts` and `src/shared/api/domain.ts`). The
primitive ships; the wiring is a one-line drop-in once the backend lifts
`trace_id` onto those rows.

Documentation updates:

- `docs/tracing-ui-gates/dod-13-deferred.md` — new ADR-style note.
- `phase-5.md` — added a sub-bullet under ViewTraceLink and elevated the
  data-gap section to a top-line "DoD #13 deferred" conformance item.
- `commit-plan.md` Group 5 — message tightened from "cross-link
  affordances" to "ViewTraceLink primitive"; rationale updated.
- Group 6 — `dod-13-deferred.md` added to the file list; counts updated
  (G6: 2 → 3, total in-group: 73 → 74).

### DoD checklist update (spec §2)

- [~] **DoD #13 — Cross-link affordances** — primitive ships; the three
  documented host-surface wirings are **deferred** pending backend
  `trace_id` lift. See `docs/tracing-ui-gates/dod-13-deferred.md`[^dod13]
  and the Phase 5 conformance notes.

[^dod13]: Backend-blocked; tracked as a follow-up. Phase 5's
  "DoD #13 deferred — backend schema dependency" conformance section
  carries the full data-gap reasoning.

### Verification

- `pnpm typecheck` — PASS.
- `pnpm lint` — PASS.
- `pnpm test` — see report tail in the orchestrator hand-off.
- `pnpm test:e2e tests/admin-traces-list.e2e.ts tests/admin-traces-detail.e2e.ts tests/admin-traces-detail-tabs.e2e.ts tests/admin-traces-retry.e2e.ts tests/cross-link-view-trace.e2e.ts`
  — **18 / 18 PASS** with ZERO axe-core violations.
- `git rev-list --count tracing-admin-ui --not main` — **0**.
