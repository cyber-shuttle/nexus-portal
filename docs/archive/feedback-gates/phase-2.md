# Feedback Mode — Phase 2 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-23-nexus-portal-feedback-mode.md`
**Phase:** 2 — Annotation overlay (5 tools + undo + clear + optional-screenshot path)
**Date:** 2026-05-23

## Deliverables shipped

| Deliverable | Path | Status |
|---|---|---|
| SVG annotation overlay (5 tools, viewBox-coordinate space) | `src/features/feedback/FeedbackOverlay.tsx` (274 LOC) | done |
| `flattenToPng` + `shapesToJson` serializers | `src/features/feedback/serializer.ts` (73 LOC) | done |
| Vitest unit tests for serializer | `src/features/feedback/__tests__/overlay-serializer.test.ts` | done — 4 tests |
| Panel rebuild: header, toolbar, comment box, submit/cancel | `src/features/feedback/FeedbackPanel.tsx` (322 LOC) | done |
| Remove-screenshot path → text-only banner | same | done |
| Cmd/Ctrl+Z undo + Undo/Clear buttons | same | done |
| 501-as-stub-success path with sonner toast | same | done |

## Architecture notes

- **State lifted to panel.** `shapes`, `draft`, and `tool` live in `FeedbackPanel`; `FeedbackOverlay` is a controlled SVG surface that calls `onCommitShape` / `onDraftUpdate`. Keeps the overlay pure-presentational and lets the panel own Undo/Clear/Cmd-Z without prop-callbacks for every action.
- **Draft mirrored in a ref.** React batches state across rapid pointer events — within a single user drag, `pointermove` handlers were firing with a stale closure `draft = null` because no re-render had happened yet between `pointerdown`'s `setDraft` and the next `pointermove`. Fixed by mirroring `draft` in a `useRef` that the move/up handlers read instead of the prop. The prop still drives rendering; the ref is just the live cursor for in-flight events.
- **viewBox coordinate space.** The SVG carries `viewBox="0 0 ${naturalW} ${naturalH}"` so all shape coords live in image-natural pixels and survive the responsive `max-h-[60vh] max-w-[90vw]` <img> resize. `preserveAspectRatio="none"` is safe because the wrapper sizes the SVG to the same box as the `<img>`. Pointer coords get mapped via `getBoundingClientRect()` ratios — straightforward, no `getScreenCTM` needed.
- **setPointerCapture guarded.** Wrapped in try/catch — non-fatal in jsdom and in the Chrome-MCP synthetic-event path where the pointer ID is arbitrary.
- **Text tool uses an inline `<input>`**, not `window.prompt`. Click drops an absolutely-positioned input at the click point; ENTER commits, ESC cancels, blur commits (matches "feels like a real text overlay" rather than a modal interruption). The input is positioned in displayed-pixel space (svg rect / image-natural ratios) so it lands where the user clicked even with the responsive image scaling.
- **Submit handler.** When screenshot present, calls `flattenToPng` → `FileReader.readAsDataURL` → strip prefix → `imagePngBase64`. When text-only, omits the image/annotations fields entirely. Posts to `/api/feedback`; treats 501 as stub success per the brief — sets an inline message and fires a sonner `toast.info` saying "Suggestion captured — submission wiring lands in Phase 3."
- **Context payload is a hard-coded stub** (route from `location.pathname`, persona `'unknown'`, email `'unknown@local'`, empty outline). Phase 4 replaces this with real values; no `componentOutline.ts` / `consoleBuffer.ts` files exist yet per the brief.

## Bundle delta vs. Phase 1 baseline

| Route | Phase 1 First-Load JS | Phase 2 First-Load JS | Delta |
|---|---|---|---|
| `/projects` | 222 kB | **222 kB** | 0 kB |
| `/home` | 171 kB | **171 kB** | 0 kB |
| `/allocations` | 201 kB | **201 kB** | 0 kB |
| Shared chunks | 103 kB | **103 kB** | 0 kB |

Within the ±2 kB budget — the panel chunk is still entirely lazy.

## Gate evidence

```text
$ pnpm typecheck   # exit 0
$ pnpm lint        # Checked 412 files. No fixes applied. exit 0
$ pnpm test        # Test Files 53 passed (53), Tests 372 passed (372)
$ pnpm build       # ✓ Compiled successfully; first-load JS table identical to Phase 1
```

### Chrome MCP visual QA

Dev server on `http://localhost:3001` (port 3000 held by Docker), signed in as `researcher@nexus.local` via the dev FAB carry-over from Phase 1.

| # | Screenshot | Verifies |
|---|---|---|
| 01 | `phase-2-screenshots/panel-loaded.png` | Panel opens on `/projects`; toolbar renders all 5 tools with `aria-pressed=true` on the default Rectangle; Undo/Clear disabled; "Remove screenshot" button visible in the header |
| 02 | `phase-2-screenshots/all-tools-drawn.png` | One primitive of each type committed onto the screenshot: rect outline, redact opaque-black block, accent-red arrow with arrowhead marker, pen squiggle, and a text label. SVG count after: 2 rects + 1 line + 2 paths (pen + marker) + 1 text |
| 03 | `phase-2-screenshots/after-clear.png` | Undo popped the text, then Clear wiped all remaining shapes. SVG count back to baseline (defs marker only) |
| 04 | `phase-2-screenshots/submit-stub-toast.png` | Re-added a single rect, typed a 31-char comment, hit Submit. Server returned 501 → sonner toast "Suggestion captured — submission wiring lands in Phase 3." appears top-right; inline message "Server route not implemented yet (Phase 3) — but the panel did everything it could from here." rendered below the textarea |
| 05 | `phase-2-screenshots/text-only-mode.png` | After re-opening + clicking Remove screenshot: screenshot region replaced by the muted banner ("Screenshot removed — your suggestion will be filed with just the text and the page's structural context."); toolbar removed entirely; Submit still wired and produced the same toast when triggered with a typed comment |

### A11y spot check

Toolbar buttons (snapshot before draw):

```
button "Rectangle" pressed                    # aria-pressed=true
button "Arrow"                                # aria-pressed=false
button "Text"
button "Pen"
button "Redact"
button "Undo" disableable disabled            # disabled when shapes empty
button "Clear" disableable disabled
textbox "Tell us what you'd suggest" multiline   # labelled via <label for>
```

After switching to Arrow, only "Arrow" reports `pressed`. Dialog carries `aria-labelledby="feedback-panel-title"` matching the `<h2 id="feedback-panel-title">Suggestion mode</h2>`. The annotation SVG has `role="img"` + `aria-label="Annotation surface"` + `<title>` so Biome's `noSvgWithoutTitle` is satisfied without polluting visual chrome.

## Drift from the brief

- **Text-tool input UX**: kept the spec's inline-input approach (not `window.prompt`). Commits on ENTER, ESC, or blur — blur commit was an addition so a user tapping outside the input doesn't leave a phantom ghost-input. Acceptable because empty text never commits a shape.
- **501 papering**: brief mentions both "show toast" and "set submitError". I do both — the inline message stays as authoritative status, the toast is the prominent flag. Dialog stays open in stub mode (no `closeMode()`) so the user can adjust/retry.
- **setPointerCapture is best-effort.** Wrapped in try/catch because jsdom and the Chrome-MCP synthetic-event path both error on arbitrary pointer IDs. Real browser pointers (mouse/touch/pen) work the same as before.
- **React 19 batching surprise**: a synchronous burst of `pointerdown` → `pointermove…` from `evaluate_script` fired faster than React rendered, so closure-captured `draft` stayed null for every move. The ref-mirror fix is now the production code path too — production users have natural inter-event gaps, but the ref is the correct shape regardless and removed the only place the prop was read inside an event handler.
- **Workspace root limitation**: Chrome MCP refused to save into `/Users/lahiruj/Projects/dev/apache/nexus-portal/...` because that path is outside its registered workspace roots. Workaround: saved into `/var/folders/.../T/` first, then `cp`'d into the gate-report directory. Worth registering `nexus-portal` as an additional workspace root before Phase 4's visual QA.

## Files touched

```
A src/features/feedback/FeedbackOverlay.tsx
A src/features/feedback/serializer.ts
A src/features/feedback/__tests__/overlay-serializer.test.ts
M src/features/feedback/FeedbackPanel.tsx       (rebuilt — Phase 1 shell replaced)
A docs/feedback-gates/phase-2.md                (this file)
A docs/feedback-gates/phase-2-screenshots/{panel-loaded,all-tools-drawn,after-clear,submit-stub-toast,text-only-mode}.png
```

`FeedbackProvider.tsx`, `capture.ts`, `types.ts`, `NeedHelpCard.tsx`, `PortalLayout.tsx`, and `api/feedback/route.ts` are unchanged — Phase 2 confined to the new files plus the FeedbackPanel rewrite.

## Carry-overs to Phase 3

None blocking. Notes:
- Context payload is stubbed (persona/email/outline). Phase 4 owns the real capture.
- `flattenToPng` always uses `crypto.randomUUID()`; jsdom supports it, but the file-upload path in Phase 3 should still validate the id server-side.
- The route still returns 501. Phase 3 replaces it; the client's stub-success branch should be removed once the real handler lands.

Status: **gate passed**. Phase 3 unblocked.
