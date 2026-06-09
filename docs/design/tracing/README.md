# Design Handoff: Custos Admin — Trace View

> Source-of-truth design spec for `/admin/traces`. Read top-to-bottom before changing the trace view UI — this captures the design intent at a pixel-level detail the operational spec at [`../../features/tracing.md`](../../features/tracing.md) does not.
>
> The original handoff also shipped with a runnable HTML/React-via-Babel prototype that mounted the design in a browser. The prototype is no longer in the repo (git history preserves it); the prose below is self-sufficient.

---

## Overview

The **Trace View** is an admin surface in the **nexus-portal** (product: *Custos*). It lets a site administrator investigate distributed traces — audit-log rows joined into a span tree — to find **where a multi-step flow broke** (e.g. an AMIE account-provisioning request that failed on a COmanage 404) and, eventually, retry from the failed step.

It has two primary surfaces:
1. **Trace list page** — filterable table of recent traces.
2. **Trace detail drawer** — a right-side drawer (opened by clicking a trace row) with four tabs; the centerpiece is a **hierarchical span tree** with a red "error rail" that draws the eye from the root down to the precise failing span.

---

## How to use this document

Implement the design using the codebase's existing patterns — TypeScript, Tailwind + shadcn/ui, TanStack Query, the design tokens already defined in `design-tokens/`. The tokens listed below are the *intent* of each color/type role; if a matching token already exists in `design-tokens/colors.css`, use the real one and treat the value here as a fallback specification.

The status-derivation logic and the tree-building rules in `src/features/tracing/utils.ts` are direct mirrors of the design intent captured in this document (`rowTone`, `buildTree`). Keep them aligned.

---

## Fidelity

**High-fidelity (hifi).** Final colors, typography, spacing, interactions, empty/loading/running/error states are all specified. Recreate the UI faithfully using the codebase's existing libraries — match layout, hierarchy, and the specific status semantics precisely. Pixel-exact margins matter less than getting the **information hierarchy and the error-path emphasis** right.

---

## Design Tokens

> These map to CSS custom properties. Prefer the real nexus-portal tokens in `design-tokens/colors.css` if a matching role already exists.

### Color — neutral (cool slate)
| Token | Hex | Use |
|---|---|---|
| `--background` | `#ffffff` | app background behind cards |
| `--foreground` | `#0f172a` | primary text |
| `--card` | `#ffffff` | card / panel surfaces |
| `--muted` | `#f1f5f9` | hover fills, chips |
| `--muted-2` | `#f8fafc` | page bg, zebra rows, code blocks |
| `--muted-foreground` | `#64748b` | secondary text, labels |
| `--border` | `#e7ebf0` | hairline borders |
| `--border-strong` | `#d6dce4` | input/button borders |
| `--ring` | `#2563eb` | focus ring |

### Color — brand & primary
| Token | Hex | Use |
|---|---|---|
| `--brand` | `#2563eb` | primary accent, links, selected, focus |
| `--brand-tint` | `#eff4ff` | selected-row fill, active filter pill bg |
| `--primary` | `#0f172a` | primary button bg (near-black) |
| `--primary-fg` | `#ffffff` | primary button text |

### Color — status
| Tone | dot/solid | bg (50) | fg/text (700) |
|---|---|---|---|
| **ok** (green) | `#16a34a` | `#ecfdf3` | `#15803d` |
| **error** (red) | `#ef4444` | `#fef2f2` | `#b91c1c` |
| **in-progress** (amber) | `#f59e0b` | `#fffbeb` | `#b45309` |
| **orphaned / no-status** | `#64748b` (hollow ring) | `#f1f5f9` | `#64748b` |

Red ramp also uses: `--nexus-red-100 #fee2e2` (chip borders), `--nexus-red-500 #ef4444` (the rail), `--nexus-red-600 #dc2626` (alert icons).

### Color — source pills
| Source | bg | fg |
|---|---|---|
| `amie` | `#eff6ff` | `#1d4ed8` (blue) |
| `comanage` | `#f5f3ff` | `#6d28d9` (purple) |
| `slurm` | `#fffbeb` | `#b45309` (amber) |
| `http` | `#f1f5f9` | `#64748b` (slate) |
| `core` | `#f1f5f9` | `#64748b` (slate) |

### Typography
- **Sans (UI):** `Inter`, system fallback. Body 14px / line-height 1.4.
- **Display (headings, brand):** `Manrope`, weights 700–800. Page title 28px/700, letter-spacing −0.01em. Drawer root-action title 19px/700.
- **Mono:** `ui-monospace, 'SF Mono', Menlo, Consolas`. Used for trace/span IDs, attribute values, and **code-shaped action names** (no spaces, e.g. `comanage.create_person`). Phrase-shaped actions (with spaces) render in sans.
- Type sizes seen: 28 (page h1), 19 (drawer title), 15.5 (panel title), 14 (body), 13.5 (buttons/nav/table), 13 (detail values), 12.5 (meta), 12 (mono attrs), 11.5–11 (uppercase section labels, `letter-spacing .03–.05em`, weight 600–700).

### Spacing, radius, shadow
- Radius: pills `6–7px`, cards/panels `10–12px`, round filter pills `14px`, full-round badges `16–18px`.
- Shadows: `--shadow-sm 0 1px 2px rgba(15,23,42,.06)`; `--shadow-md 0 4px 12px rgba(15,23,42,.08), 0 1px 3px rgba(15,23,42,.06)`; drawer `-12px 0 40px rgba(15,23,42,.14)`.
- Layout rails: sidebar `232px`, topbar height `56px`, list max-width `1280px`, drawer width `min(1080px, 94vw)`, detail panel within tree `360px`.

---

## Screens / Views

### 1. App shell (chrome)

- **Sidebar** (`232px`, fixed, `--card` bg, right hairline border):
  - Brand block at top (`56px` tall, bottom border): a `28px` rounded-square shield logo (`--primary` bg, white shield-check glyph) + "Custos" (Manrope 15/800) over "NEXUS PORTAL" (10.5px/600, `--muted-foreground`, letter-spacing .04em).
  - Section label "ADMIN" (uppercase, 10.5px/700).
  - Nav items (`38px` tall, `8px` radius, `11px` icon→label gap, 13.5px): Overview, Users, Projects, Allocations, **Tracing** (active), Connectors, Settings. Active item: `--muted` bg, foreground text/600, icon tinted `--brand`. Inactive: transparent, `--muted-foreground`.
  - Footer: user avatar (32px gradient circle `#6d28d9→#2563eb`, white initials) + name + "Site administrator".
- **Topbar** (`56px`, sticky, translucent white `rgba(255,255,255,.82)` + `backdrop-filter: blur(8px)`, bottom border):
  - Left: breadcrumb "Admin / **Tracing**".
  - Right: user chip (avatar + name in a rounded-18px pill).
- **Main**: scrollable region holding the list page.

### 2. Trace list page

Max-width `1280px`, centered, padding `24px 32px 48px`.

- **Heading row**: h1 "Traces" (Manrope 28/700) + subtitle "Investigate where a flow broke and retry from the failed step." On the right, a **"Last synced Ns ago"** badge — rounded-16 pill, green pulsing dot, counter ticks every second (purely cosmetic in prototype; wire to real sync state).
- **Sticky failure banner** (only when ≥1 error trace is >24h old): full-width red button (`--nexus-red-50` bg, `--nexus-red-100` border, `10px` radius), alert icon + "**N traces failing for over 24h**" + right-aligned "Investigate →". Clicking it applies the filter preset (status=error, window=30d).
- **Filter strip** (card, `12px` radius, `--shadow-sm`):
  - **Status** group (multi-select pills, default **error** selected): error / ok / in-progress / orphaned. Each pill has a leading status dot (hollow ring for orphaned).
  - vertical divider.
  - **Source** group (multi-select pills): amie / comanage / slurm / http / core.
  - vertical divider.
  - **Window** group (single-select **round** pills): 24h / 7d / 30d (default 30d).
  - Active pill: `--brand` border, `--brand-tint` bg, `--brand` text. Inactive: `--border-strong` border, card bg.
  - **Search input** below (full width, 38px, leading search icon): placeholder "Search trace_id / span_id / entity / action…". Filters across trace_id, root_action, error_summary, and entity values.
- **Trace table** (card, `12px` radius):
  - Column grid: `120px 132px 1fr 96px 64px` → **Started · Trace ID · Root action · Source · Spans**.
  - Header row: `--muted-2` bg, uppercase 11.5px labels.
  - **Row** (12px vertical padding, bottom hairline, hover → `--muted-2`):
    - Error rows get a **3px red left edge bar** (absolute, full height).
    - *Started*: relative time ("2m ago"), `title` = absolute UTC.
    - *Trace ID*: first 8 hex chars + "…", **click-to-copy** (stops row navigation). Mono.
    - *Root action*: status dot + mono action name (truncates). **Second line** under it: for errors, the red `error_summary` (e.g. "ComanageProvisioningFailed: 404"); for in-progress, italic amber "…still running".
    - *Source*: source pill.
    - *Spans*: tabular-nums count + a hover-reveal "open →" affordance (turns `--brand` on row hover).
  - Empty state: "No traces match these filters."
- **Pagination row**: Prev/Next (disabled in prototype), "Page 1 of 1 · **N** traces", rows-per-page select (25/50/100). Visual only — wire to real paging.

### 3. Trace detail drawer

Opens from the right when a row is clicked. Scrim `rgba(15,23,42,.32)` (click to close). Panel `min(1080px, 94vw)`, full height, `--shadow-drawer`, slides in (`220ms cubic-bezier(.22,1,.36,1)`). **Esc closes.**

**Header** (`padding 18px 24px 0`):
- Eyebrow row: "TRACE" label + **full trace ID** (click-to-copy, explicit copy icon) + trace-level **status pill**.
- **Root action** title (Manrope 19/700, mono if code-shaped).
- If error: red line — alert icon + `error_summary` + " at span `<failing_action>`".
- Right-aligned actions:
  - **Refresh** button (outline) — only shown for `in-progress` traces. Tooltip: "Refresh — manual polling, no auto-refetch."
  - **Retry** button (primary, **disabled** in v1). Tooltip: *"Retry coming soon. When enabled, retry will replay the correlated event under a new trace, linked to this one. Preview the original payload in Overview."* `aria-label` notes it's disabled / coming soon.
  - **Close** (×) icon button.
- **Tabs** (underline style, active = foreground text + 2px `--brand` underline): **Overview**, **Tree (N)**, **Raw**, **Linked entities**. Default tab: **Tree**. Tab labels must not wrap.

**Body** behavior: Tree tab uses `overflow: hidden` (it manages its own internal scroll); all other tabs scroll.

#### 3a. Overview tab
- **"Trace facts"** table (zebra rows): Trace ID (copy), Source (pill), Root action (mono), Status (pill), Started (abs UTC + relative), Ended (abs, or italic amber "still running"), Duration (computed first-start → last-end), Span count.
- **"Root entity"** card row: one bordered chip per entity attribute (key label + copyable value).
- **"Attempts"** section: dashed-border empty state — "No retry attempts yet. When retry ships, each attempt appears here as a linked sub-trace." (Designed-for-future; render empty in v1.)

#### 3b. Tree tab — **the centerpiece**
Two-column split: **span tree** (flex 1) | **span detail panel** (`360px`), `24px` gutter.

- **Toolbar**: "Expand all" / "Collapse all" (outline buttons) · "Errors only" checkbox · right-aligned status summary ("N spans · all ok" green / "N spans · running" amber / "X of Y rows" when filtered).
- **Error chip** (only if ≥1 error leaf): red banner — alert icon + "**N errors**" + (if >1) "**c of N**" counter with up/down nav buttons + right-aligned "jump to row →". Prev/next cycle through failing leaves (also bound to `p`/`n` keys).
- **Tree** (`role="tree"`, focusable, `border + 10px radius`, internal scroll):
  - **The red error rail**: an absolutely-positioned vertical bar (`left: 10px`, width 2–4px configurable, `--nexus-red-500`, `2px` radius) spanning from the **first** to the **last** visible row on the error path. **Measured from the DOM** (`getBoundingClientRect` of the first/last error-path rows relative to the scroll container) — recompute on expand/collapse/filter/scroll/resize.
  - **Row** (`role="treeitem"`, `aria-level`, `aria-selected`, `aria-expanded`):
    - Indent = `10 + depth*20px` (capped at depth 5; deeper rows prefix the action with "…/"). Optional **dotted connector** guides (tweakable; default off).
    - Disclosure chevron for rows with children (rotates 90° when expanded).
    - **Status dot** (8px; hollow ring for orphan/no-status; amber dot **pulses** for running).
    - **Action name** (mono if code-shaped / sans if phrase; 600 for structural/error rows, 500 leaves).
    - **Hidden-error badge**: collapsed parents whose subtree contains a failure show a small red alert icon.
    - "(orphan)" tag for rows whose `parent_span_id` doesn't resolve in the trace.
    - **Source pill**.
    - **Meta tail** (right-aligned, ≤46% width, truncates): running → italic "…still running"; not-run → "skipped (parent err)"; else a key entity attr (user/packet/co_person/cluster…); errors append `status=<http.status_code>` in red + a red alert icon.
    - **Selected** row: `--brand-tint` bg, inset `--brand` ring, 2.5px `--brand` left bar.
    - **Precise failing leaf** (an error row with no error descendant) gets the **loud** treatment: faint red fill + 3px red left bar + trailing alert icon. Ancestor error rows on the path stay calm — only the rail connects them. *This distinction matters: the admin wants the exact leaf that broke, not every ancestor that propagated the failure.*
  - **Keyboard nav** (tree is focusable): ↑/↓ move selection, → expand / dive in, ← collapse / go to parent, `n`/`p` next/prev error leaf, ⌘/Ctrl+C copy selected span ID.
- **Span detail panel** (right, read-only): action title + "Open in Raw tab →" link · status pill + source pill + kind · facts (Time abs+rel, Duration, red Status message) · **Summary** paragraph · **Attributes** table (zebra, each value **click-to-copy**) · **IDs** (Trace / Span / Parent, copyable, mid-truncated when narrow).

#### 3c. Raw tab
- "Trace JSON · N spans" label + **Copy JSON** button.
- `<pre>` block (`--muted-2` bg, mono 12/1.6) with **syntax highlighting**: keys purple `#6d28d9`, strings green `#15803d`, booleans/null amber `#b45309`, numbers blue `#1d4ed8`. JSON shape: `{ trace_id, source, status, root_action, span_count, spans:[{ span_id, parent_span_id, action, source, status, started_at, ended_at, status_message?, summary, attributes }] }`.

#### 3d. Linked entities tab
- Intro line, then a responsive grid (`minmax(240px,1fr)`) of entity cards. Each card: a tinted icon tile (per entity kind) + uppercase kind label + copyable ID + "View <kind> ↗" deep-link. Entities are derived by scanning span attributes: AMIE packet (`amie.packet_id`), User (`entity.user_id`), Project (`entity.project_id`/`project.id`), CO person (`comanage.co_person_id`), Allocation (`allocation.id`), Cluster account (`slurm.account`). **Wire the deep-links to the real portal entity routes.**

---

## Interactions & Behavior

- **Open trace**: click any list row → drawer opens (Tree tab). Clicking the trace-ID cell copies instead of opening (event stop-propagation).
- **Close drawer**: scrim click, × button, or **Esc**.
- **Tree expand/collapse**: per-row chevron, plus Expand-all / Collapse-all. Default: all structural nodes expanded.
- **Errors-only**: filters visible rows to the error path; rail + chip recompute.
- **Error navigation**: chip up/down or `n`/`p` cycles failing leaves, scrolling the selected one into view (manual scroll math — do **not** use `scrollIntoView`, it disrupts the container).
- **Copy**: trace IDs, span IDs, and every attribute value are click-to-copy with a 1.1s check-mark confirmation. Use the platform clipboard API with a graceful fallback.
- **Tooltips**: hover/focus, dark bg, on Refresh and the disabled Retry.
- **Animations**: drawer slide-in 220ms; scrim fade 180ms; pulsing dots for running/sync (`pulseDot` keyframe). **Respect `prefers-reduced-motion`** — all the above collapse to near-instant.

### States to implement
- **ok** trace: calm, no rail, no chip, green summary.
- **in-progress**: amber pulsing dots, "…still running", Ended = "still running", Refresh button visible.
- **error (single leaf)**: rail root→leaf, "1 error" chip (no counter), loud leaf.
- **multi-error**: rail spans full error region, "N errors · c of N" with prev/next over the leaves.
- **orphan**: row tagged "(orphan)", hollow status dot.
- **not-run / skipped**: hollow dot, "skipped (parent err)" meta, no duration.
- **empty list**: "No traces match these filters."

---

## State Management

Prototype keeps everything in local React state; in production, lift data fetching to your data layer (React Query / RTK / loader). Conceptual state:

**List page**
- `statusFilter: Set<'error'|'ok'|'in-progress'|'orphaned'>` (default `{error}`)
- `sourceFilter: Set<source>`
- `window: '24h'|'7d'|'30d'` (default `30d`)
- `query: string` (debounced search)
- `rowsPerPage`, `page`
- `openTraceId: string | null` (drives the drawer)
- Derived: filtered traces; banner count (errors older than 24h).

**Drawer / tree**
- `activeTab: 'overview'|'tree'|'raw'|'linked'` (default `tree`)
- `expanded: Set<spanId>` (default all structural)
- `selectedSpanId`
- `errorsOnly: boolean`
- `errorCursor: number` (index into failing-leaf list)
- Derived (memoized): `tree` (built from `spans` by `parent_span_id`), `errorPathSet` (root→error chains), `errorLeafIds` (error rows with no error descendant), flattened visible rows, rail geometry (from DOM measurement).

**Data fetching**
- List: `GET` traces with `{status[], source[], window, q, page, pageSize}` → rows `{trace_id, source, started_at, root_action, span_count, status, error_summary?, failing_action?, over24h, entity{}}`.
- Detail: `GET` trace by id → full `spans[]` (see Raw JSON shape). Tree is built client-side by joining `span_id`/`parent_span_id`.
- **Status derivation** (important): a span's tone comes from integer `status` (`0`=ok, `1`=error, `null`=no-status), overridden by run-state flags (`running`, `notRun`, `orphan`) and name heuristics (action ending in `Failed`, containing `Error`, or carrying a `status_message` ⇒ error). Port this logic exactly — it drives every dot, the rail, and the chip.
- Polling: manual only (Refresh button). No auto-refetch in v1.

---

## Assets

- **Icons**: stroke-based SVGs (24-viewBox) — chevron, copy, check, external, refresh, search, x, alert, arrows, expand/collapse, and nav glyphs (pulse, grid, users, box, server, cog, link). The portal uses Lucide, which maps 1:1 to most of these.
- **Fonts**: Manrope + Inter. Loaded via `next/font/google` from the portal's `app/layout.tsx`.
- **No raster assets / logos** beyond the inline shield glyph — swap for the real Custos mark.

---

## Where the implementation lives

| Concern | File |
|---|---|
| App shell (sidebar, topbar) | `src/shared/layout/PortalLayout.tsx`, `Sidebar.tsx`, `Topbar.tsx` |
| List page (filters, banner, table, pagination) | `src/features/tracing/components/TraceListContainer.tsx`, `TraceFilterStrip.tsx`, `TraceTable.tsx`, `TraceTrendChart.tsx` |
| Detail drawer + tabs | `src/features/tracing/components/TraceDetailDrawer.tsx` + `TraceOverviewTab.tsx`, `TraceTreeTab.tsx`, `TraceRawTab.tsx`, `TraceLinkedEntitiesTab.tsx` |
| Span tree + error rail + keyboard nav | `src/features/tracing/components/TraceTreeTab.tsx`, `TraceWaterfallRow.tsx`, `TraceSpanDetailPanel.tsx` |
| Status-derivation logic (`rowTone`) | `src/features/tracing/utils.ts` |
| Primitives (`StatusPill`, `SourcePill`, copyable value) | `src/features/tracing/components/primitives/` |

---

## Suggested build order

If you're rebuilding this surface from scratch:

1. Port **design tokens** into the codebase's token system (or confirm they already exist in nexus-portal).
2. Build **primitives** (StatusPill, SourcePill, copyable value, status-derivation util) — or map to existing ones.
3. Build the **list page** (filters → table → row), wired to the traces API.
4. Build the **drawer shell** + tabs; Overview/Raw/Linked first (they're straightforward).
5. Build the **span tree** last — tree construction, error-leaf logic, the DOM-measured rail, keyboard nav. This is the highest-value, highest-effort piece; budget accordingly.
