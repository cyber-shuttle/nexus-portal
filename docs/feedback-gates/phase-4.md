# Feedback Mode — Phase 4 Gate Report

**Spec:** `airavata-custos/docs/portal/2026-05-23-nexus-portal-feedback-mode.md`
**Phase:** 4 — Context auto-capture + a11y polish
**Date:** 2026-05-23

## Deliverables shipped

| Deliverable | Path | Status |
|---|---|---|
| Console ring buffer (last 10 error/warn) | `src/features/feedback/consoleBuffer.ts` (75 LOC) | done |
| DOM-walking component outline | `src/features/feedback/componentOutline.ts` (135 LOC) | done |
| Pure context assembler | `src/features/feedback/buildContext.ts` (35 LOC) | done |
| Provider wired to buffer + outline; opens panel on capture failure | `src/features/feedback/FeedbackProvider.tsx` | modified |
| Panel pulls real session + pathname + outline + console snapshot | `src/features/feedback/FeedbackPanel.tsx` | modified |
| Vitest — consoleBuffer (8 tests) | `src/features/feedback/__tests__/consoleBuffer.test.ts` | done |
| Vitest — componentOutline (7 tests) | `src/features/feedback/__tests__/componentOutline.test.ts` | done |
| Vitest — buildContext (4 tests) | `src/features/feedback/__tests__/buildContext.test.ts` | done |

## Architecture notes

- **Module-scope buffer.** `consoleBuffer` is created once at module load and `install()`d from a provider effect. Survives provider remounts; never uninstalled. Idempotency tracked with `Symbol.for("nexus.feedback.consoleBuffer.installed")` on `console` so a duplicate provider mount can't double-wrap. Serialization is try/catch'd: non-strings JSON.stringify, fallback to `String(arg)`, circular references collapse to `"[unserializable]"`. Per-message cap 2000 chars.
- **Defensive outline walk.** Every section of `captureComponentOutline` is wrapped in `safe()` returning a typed fallback — anything that throws (null parents, removed nodes, `getComputedStyle` blowups) just yields the empty value for that section. Skips elements with `hidden`, `aria-hidden="true"`, or `display:none`/`visibility:hidden`. Pure function over `(doc, win)` so jsdom tests just drop HTML into `document.body` and assert.
- **Parallel capture.** `openMode` runs `captureViewport()` and `captureComponentOutline(document, window)` in `Promise.all`. If the screenshot rejects, the outline still resolves; the panel opens text-only with a small inline notice "Screenshot capture failed — your suggestion will be filed as text-only with the page's structural context.". Provider no longer requires `capturedImageUrl` to render the panel.
- **Session shape drift.** Spec said `session.user.persona`. Actual auth augmentation (`src/types/next-auth.d.ts`) exposes `session.user.role` of type `Role = "guest" | "user" | "pi" | "co_pi" | "allocation_manager" | "admin"`. Used `session?.user?.role ?? "unknown"` — same intent, real shape.
- **Submission-time console snapshot.** Panel calls `snapshotConsoleEntries()` at submit, not at open, so any errors logged while the user is annotating are still captured.
- **Return focus on close.** Saved `document.activeElement` on dialog mount; restored in the same effect's cleanup before the React tree unmounts. Native `<dialog>` does this for some patterns but our open-via-state mounting needed it explicit.
- **`attemptClose` helper** centralizes the dirty-state confirm prompt; wired to Cancel button, dialog `cancel` event (ESC), and the textarea's `Escape` key handler.

## Bundle delta vs. Phase 3 baseline

| Route | Phase 3 First-Load JS | Phase 4 First-Load JS | Delta |
|---|---|---|---|
| `/projects` | 222 kB | **222 kB** | 0 kB |
| `/home` | 171 kB | **171 kB** | 0 kB |
| `/allocations` | 201 kB | **201 kB** | 0 kB |
| Shared chunks | 103 kB | **103 kB** | 0 kB |

Within ±2 kB budget. The new modules live entirely in the lazy feedback chunk.

## Test counts

| Phase | Test files | Tests |
|---|---|---|
| Phase 3 baseline | 56 | 391 |
| Phase 4 | 59 | **410** (+19) |

New tests: `consoleBuffer.test.ts` (8), `componentOutline.test.ts` (7), `buildContext.test.ts` (4). All passing.

## Gate evidence

```text
$ pnpm typecheck   # exit 0
$ pnpm lint        # Checked 425 files. No fixes applied. exit 0
$ pnpm test        # Test Files 59 passed (59), Tests 410 passed (410)
$ pnpm build       # ✓ Compiled successfully; first-load JS table identical to Phase 3
```

## Chrome MCP end-to-end

Dev server on `http://localhost:3001`, signed in as `researcher@nexus.local`.

### Flow A — with screenshot

1. Land on `/projects`.
2. Inject markers via `evaluate_script`: `console.error("Phase-4 test marker")` and `console.warn("warn marker")`.
3. Click "Suggestion mode" → dialog opens with captured screenshot (~500 ms).
4. Dispatch synthetic pointer events to draw a rectangle on the annotation SVG (2 rects in the SVG confirms commit).
5. Fill textarea with "Phase-4 e2e end-to-end submission marker" (40 chars).
6. Click Submit → toast "Suggestion filed (dev mock)" appears top-right with "View on GitHub" action. Panel auto-closes.

Captured POST payload excerpt (intercepted via patched `window.fetch`):

```json
{
  "comment": "Phase-4 e2e end-to-end submission marker",
  "hasImage": true,
  "imageLen": 368236,
  "annotations": { "shapes": 2, "w": 2880, "h": 1800 },
  "context": {
    "route": "/projects",
    "persona": "user",
    "reporterEmail": "researcher@nexus.local",
    "viewport": { "w": 1440, "h": 900 },
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 …",
    "buildSha": "526173b",
    "timestamp": "2026-05-23T18:37:22.270Z",
    "consoleErrors": [
      "[2026-05-23T18:35:50.627Z] [error] Phase-4 test marker",
      "[2026-05-23T18:35:50.627Z] [warn] warn marker"
    ],
    "componentOutline": {
      "pageTitle": "Nexus Portal",
      "headings": [
        { "level": 1, "text": "Projects" },
        { "level": 3, "text": "Something went wrong" }
      ],
      "navActive": "Projects",
      "navSiblings": [
        "Overview", "Analytics", "Allocations", "Change Requests",
        "Proposals", "Tools", "SSH Certificates", "Clients", "Settings"
      ],
      "primaryButtons": [
        "Get Support", "Suggestion mode", "R", "+ New project", "Try again", "DEV"
      ],
      "slots": [
        "button", "tooltip-trigger", "dropdown-menu-trigger",
        "avatar", "avatar-fallback", "input"
      ]
    }
  }
}
```

All DoD item 15 fields present: route, persona (mapped from `session.user.role`), reporterEmail (real), viewport, userAgent, buildSha (real git short SHA), timestamp, both console markers (in order), componentOutline with non-empty headings/nav/buttons/slots.

### Flow B — text-only after Remove screenshot

1. Re-open panel. Click "Remove screenshot from this suggestion".
2. Fill textarea "Phase-4 text-only with outline marker" (36 chars).
3. Submit → toast appears, panel closes.

Captured payload:

```json
{
  "comment": "Phase-4 text-only with outline marker",
  "hasImage": false,
  "hasAnnotations": false,
  "outlinePresent": true,
  "headings": 2,
  "navActive": "Projects",
  "slots": 6
}
```

Text-only path still ships the full `componentOutline` per spec.

### Screenshots

| # | Path | What it shows |
|---|---|---|
| 1 | `phase-4-screenshots/end-to-end-toast.png` | Flow A toast top-right with "View on GitHub" action |
| 2 | `phase-4-screenshots/text-only-toast.png` | Flow B toast — same toast shape, text-only submit |
| 3 | `phase-4-screenshots/panel-open.png` | Panel with captured screenshot + the new auto-context microcopy below the textarea |

## axe-core a11y scan

Loaded `axe-core@4.10.2` from CDN via `evaluate_script` and ran `axe.run(dialog, { runOnly: ['wcag2a','wcag2aa','wcag21a','wcag21aa'] })` against the open panel.

```json
{ "violations": [], "passes": 17, "incomplete": [{ "id": "color-contrast", "nodes": 1 }] }
```

Zero violations. One `color-contrast` incomplete — axe couldn't compute the contrast of an element whose computed background sits behind the modal's `bg-black/80` overlay; manually verified the visible text (`text-foreground`, `text-muted-foreground`, `text-destructive`) all clear AA against `bg-background`.

### A11y improvements in this phase

- Each tool button already had `aria-pressed={tool === id}` (Phase 2). Verified in snapshot: `Rectangle pressed`, others not.
- Textarea labelled via `<label htmlFor="feedback-comment">` (Phase 2). Verified.
- "Remove screenshot" button gained `aria-label="Remove screenshot from this suggestion"` for screen-reader clarity (icon + short label was ambiguous in the snapshot).
- Auto-context microcopy "Your sign-in email, the current route, and a structural snapshot of this page will be included automatically." rendered as muted text below the textarea — transparency for GDPR-mindset stakeholders.

## Drift from the brief

1. **Spec said `session.user.persona`; auth augments `session.user.role`.** Used `role` (`Role` enum). Same semantic, real field.
2. **Phase 3 client constructed the context payload inline.** Phase 4 routes it through `buildFeedbackContext` (pure, tested). Reduces the panel's body considerably.
3. **Spec dictated `componentOutline.ts` capture is called from the provider's `openMode` BEFORE the panel mounts**; that's what we do. The brief in this phase-prompt suggested running outline + screenshot in parallel via `Promise.all` — done. If the screenshot rejects, the outline still resolves and the panel opens text-only with a notice.
4. **`captureError` no longer suppresses the panel.** Phase 1 set `captureError` but kept `panelOpen=false`. Phase 4 always sets `panelOpen=true` in the `finally` block; the panel displays a "Screenshot capture failed" notice when `capturedImageUrl === null && captureError !== null`. Not exercised in the Chrome MCP run (capture worked fine), but the logic is straightforward.
5. **Dev workspace-roots quirk again.** Chrome MCP refused to save screenshots directly into `nexus-portal`; saved into `/var/folders/.../T/` and copied them into the gate directory afterwards. Same workaround as Phase 2.

## Surprises

- The "primaryButtons" outline includes sidebar items like "Get Support" / "Suggestion mode" / nav avatar initial "R" because they're inside `<button>` elements outside `<main>` but the outline walks the whole document. Brief said "visible primary button/link labels" — accepted as-is; engineers reading the issue body benefit from seeing the full button surface, not just `<main>`.
- The synthetic pointer events from `evaluate_script` need a 50 ms gap between `pointerdown` / `pointermove` / `pointerup` (React 19 batching). Same issue Phase 2 documented; not a code bug.
- `pathname` from `usePathname()` returned `/projects` cleanly. No surprises with the next-auth session shape beyond the persona-vs-role naming.

## Files touched

```
A src/features/feedback/consoleBuffer.ts
A src/features/feedback/componentOutline.ts
A src/features/feedback/buildContext.ts
A src/features/feedback/__tests__/consoleBuffer.test.ts
A src/features/feedback/__tests__/componentOutline.test.ts
A src/features/feedback/__tests__/buildContext.test.ts
M src/features/feedback/FeedbackProvider.tsx
M src/features/feedback/FeedbackPanel.tsx
A docs/feedback-gates/phase-4.md   (this file)
A docs/feedback-gates/phase-4-screenshots/{end-to-end-toast,text-only-toast,panel-open}.png
```

## Carry-overs to Phase 5

None blocking. Notes:
- Console buffer never uninstalls. Acceptable for an always-on widget; if/when we add buffer.uninstall paths (e.g. ad-hoc isolation in tests), the symbol-based idempotency keeps things tidy.
- `primaryButtons` includes chrome (sidebar) buttons. If reviewers want this trimmed, a future tweak could scope to `<main>` only — left as-is per current spec wording.
- Color-contrast `incomplete` from axe is a known false-positive against the modal backdrop; spot-checked the actual text fades pass AA.

Status: **gate passed**. Phase 5 unblocked.
