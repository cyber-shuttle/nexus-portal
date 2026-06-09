# ADR-0005: Filter/drawer/tab state uses `useShallowSearchParams`, not `router.replace`

**Status:** Accepted
**Date:** 2026-06

## Context

A lot of UI in this portal puts state on the URL so that refresh, back/forward, and shared links all "just work" — filter chips, the trace detail drawer, the active tab inside it, the selected span inside the waterfall.

The textbook Next.js App Router answer is `useSearchParams()` to read, `router.replace(\`?\${params}\`)` to write. We tried that first. On every keystroke in a filter input — and every drawer open, every tab switch, every span selection — `router.replace` triggers a server roundtrip to re-render the parent server component. Each one costs hundreds of milliseconds on production hardware and seconds on dev. The UI feels like syrup, the close button takes a full second to respond, and the dev experience is awful.

App Router doesn't expose a shallow-routing primitive (the v13/14 API removed `shallow: true`). The router intentionally re-renders RSC content because that's where the data lives.

## Decision

URL state mutates through a custom hook: `src/shared/hooks/useShallowSearchParams.ts`. It mirrors the Next.js `useSearchParams()` API for reads, but writes go through `window.history.replaceState(...)` and notify subscribers via a custom `shallow-search-params-change` event. No router, no RSC roundtrip.

Adoption sites: `TraceListContainer` (filters), `TraceDetailDrawer` (`?trace=`, `?tab=`), `TraceTreeTab` (`?span=`), `TabsRouter` (any tab using URL persistence).

## Consequences

- Filter typing, tab switches, drawer open/close, span selection are all instant — pure client transitions.
- The cost: the server doesn't know about URL changes you made client-side. That's fine for our use cases because all data fetching is client-side TanStack Query keyed on the URL state (read once on mount, then via the shallow hook). If you need the server to see the URL change (e.g. for SEO on a marketing page), use `router.push` / `router.replace` as normal.
- Don't introduce `router.replace` for filter/drawer/tab state, even if it would be one line shorter. Use the shallow hook. The performance regression is real and surprises every reviewer the first time.
- Don't reach into `window.history` directly — use the hook so subscribers stay in sync.
