# ADR-0004: Features don't import from each other (one documented exception)

**Status:** Accepted
**Date:** 2026-05

## Context

Feature folders (`src/features/<name>/`) follow a uniform internal layout: `schemas.ts`, `api.ts`, `queries.ts`, `components/`, `__tests__/`. As the portal grew, it became tempting to short-cut across them — render `<ProjectMembers>` from inside the change-request feature, reach into the allocations cache from analytics, etc.

Each such cross-import couples two features at compile time: a refactor in one becomes a code change in the other, the bundle splitter has a harder time, tests grow shared setup, and the LLM-assisted "rename this folder" task gets exponentially more annoying.

## Decision

Features are *isolated*. A file in `src/features/A/` cannot import from `src/features/B/`. Cross-cutting concerns live in `src/shared/`. Shared *runtime data* moves through TanStack Query's cache (any feature can `useQuery(otherFeatureKeys.detail(id))` if the schema is exported).

The one documented exception: **`src/features/tracing/components/ViewTraceLink.tsx`**. It's a primitive that any feature can render on an audit/event row to deep-link into the trace view, gated by `read Trace` ability. It's the only place a `from "@/features/tracing/..."` import appears outside the tracing folder, and the export carries an inline comment marking it as sanctioned.

## Consequences

- Features stay independently movable. A folder rename touches only routes and tests, not other features.
- Want to surface another feature's data? Either (a) export the relevant schema from feature A so feature B can consume the query directly, or (b) lift the shared concept into `src/shared/`. Don't reach into private components.
- Adding a second cross-feature primitive requires an ADR. The exception is deliberately narrow because every additional cross-import erodes the isolation property.
- The grep target for review is `from "@/features/.*/"` and `from "@features/.*/"` inside any `src/features/<other>/` file. The only legitimate hit is `ViewTraceLink`.
