# Feedback Mode — Phase 1 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-23-nexus-portal-feedback-mode.md`
**Phase:** 1 — Trigger + panel shell + capture
**Date:** 2026-05-23

## Deliverables shipped

| Deliverable | Path | Status |
|---|---|---|
| `captureViewport()` wrapper around html2canvas-pro | `src/features/feedback/capture.ts` | done |
| React context provider + `useFeedback` hook | `src/features/feedback/FeedbackProvider.tsx` | done |
| Bottom-panel shell (no annotation tools, stub textarea + Submit) | `src/features/feedback/FeedbackPanel.tsx` | done |
| "Suggestion mode" trigger button in sidebar Need Help card | `src/shared/layout/NeedHelpCard.tsx` (modified) | done |
| `FeedbackProvider` wrapped around portal children | `src/shared/layout/PortalLayout.tsx` (modified) | done |

## Architecture notes

- **Panel is a full-viewport native `<dialog>` element**, not a `vaul` Drawer. Using `<dialog>.showModal()` gives us free pointer-event blocking on the underlying page, free focus trap, and free top-layer rendering — and it satisfies Biome's `lint/a11y/useSemanticElements` rule, which rejects a `<div role="dialog">`. ESC is captured via the dialog's native `cancel` event (preventDefault + delegated to `closeMode`) so React state and the dialog stay in sync.
- **Capture-before-mount.** `openMode()` dynamic-imports `./capture`, awaits `captureViewport()`, creates an object URL, sets it in state, and only then sets `panelOpen=true`. The lazy `FeedbackPanel` is only rendered when both `panelOpen` and `capturedImageUrl` are truthy — so the panel chrome can never appear in the capture.
- **Lazy capture too.** `capture.ts` is `await import('./capture')`-ed inside `openMode` (not a top-level static import). Without this, `FeedbackProvider` → `capture` → `html2canvas-pro` would land statically in the shared chunk that every portal route loads. The build output confirms the html2canvas-pro chunk (`2e9400c5-fa1705b9e3726eda.js`, 226 KB) is loaded on-demand only and absent from every route's first-load JS.
- **Trigger gating.** The "Suggestion mode" button is disabled (with a tooltip "Sign in to send feedback") when `useSession().status !== 'authenticated'`, plus disabled mid-capture to prevent double-fire.

## Bundle delta vs. Phase 0 baseline

| Route | Phase 0 First-Load JS | Phase 1 First-Load JS | Delta |
|---|---|---|---|
| `/projects` | 222 kB | **222 kB** | 0 kB |
| `/home` | 171 kB | **171 kB** | 0 kB |
| `/allocations` | 201 kB (not in P0 report; current measurement) | **201 kB** | 0 kB |
| Shared chunks | 103 kB | **103 kB** | 0 kB |

The feedback chunk + html2canvas-pro chunk both load lazily on first click and never enter any route's first-paint payload.

## Gate evidence

```text
$ pnpm typecheck
> tsc --noEmit
(exit 0)

$ pnpm lint
> biome lint .
Checked 409 files in 38ms. No fixes applied.
(exit 0)

$ pnpm build
✓ Compiled successfully in 3.4s
(full route table identical to Phase 0 baseline — see Bundle delta table above)
```

### Chrome MCP visual QA

Dev server on `http://localhost:3002`, signed in as `researcher@nexus.local`.

| # | Screenshot | Verifies |
|---|---|---|
| 01 | `phase-1-screenshots/01-baseline-projects.png` | `/projects` before opening panel |
| 02 | `phase-1-screenshots/02-panel-open-projects.png` | Panel open at `/projects` — captured PNG visible inside panel matches the underlying page, **panel chrome (dark backdrop, footer with Submit/Cancel) is absent from the captured image**, "Suggestion mode" trigger button is correctly excluded from the captured Need Help card via `data-feedback-ignore` |
| 03 | `phase-1-screenshots/03-after-esc-projects.png` | ESC closed panel cleanly; page restored, interactive (sidebar nav links visible and clickable) |
| 04 | `phase-1-screenshots/04-baseline-home.png` | `/home` before opening panel |
| 05 | `phase-1-screenshots/05-panel-open-home.png` | Panel open at `/home` — same capture cleanliness confirmed |
| 06 | `phase-1-screenshots/06-after-esc-home.png` | ESC closed panel cleanly on `/home` |

Pointer-events block confirmed via accessibility snapshot during open state — the page snapshot lists **only** the dialog and its children; the entire underlying sidebar / topbar / main tree is suppressed from the a11y tree because `<dialog>.showModal()` raises the dialog into the top layer and inerts everything else.

## Carry-overs to Phase 2

None blocking. Notes:
- `FeedbackPanel` currently renders a disabled `<textarea>` and Submit button as placeholders — Phase 2 replaces these with the real comment input + the 5-tool toolbar + the SVG overlay surface.
- Capture exists at `<img>` natural aspect ratio with `max-h-[60vh] / max-w-[90vw]`. Phase 2 will need to overlay an SVG sized to the captured image's intrinsic dimensions — the `<img>` rendering box gives a stable layout target for that.
- No annotation logic, server submission, console buffer, redact tool, or context capture — those are Phases 2–4.

## Drift from spec

- The spec UX section (§5) sketches a ~340 px bottom sheet with the screenshot above and toolbar+comment below, both inside the panel. The implementation here is a full-viewport overlay with the screenshot occupying the upper region and a thin footer holding the placeholders — the "panel" is the whole frozen view, not a sheet. The clarification in the goal prompt called this out explicitly ("the panel is a full-viewport fixed overlay, not a vaul Drawer"); the captured PNG fills the upper region, the footer holds toolbar + comment. The 340 px sheet sketch in the spec was the wrong frame — this matches §5's "page is gone now" cue better.

## Files touched

```
A src/features/feedback/capture.ts
A src/features/feedback/FeedbackProvider.tsx
A src/features/feedback/FeedbackPanel.tsx
M src/shared/layout/NeedHelpCard.tsx
M src/shared/layout/PortalLayout.tsx
A docs/feedback-gates/phase-1.md   (this file)
A docs/feedback-gates/phase-1-screenshots/{01..06}-*.png
```

Status: **gate passed**. Phase 2 unblocked.
