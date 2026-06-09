# ADR-0002: Validate with Zod at the API boundary only

**Status:** Accepted
**Date:** 2026-05

## Context

The portal talks to several backend services with hand-written contracts that occasionally drift. A response shape change that the frontend silently absorbs can cause hard-to-debug downstream bugs hours later, far from the actual API call.

The opposite extreme — re-validating data inside every component that touches it — is verbose, slow, and creates an illusion of safety while moving the failure point further from the network edge.

## Decision

Zod validation happens exactly once per response, at the API boundary — inside each feature's `api.ts` file. Components consume the inferred TypeScript types and trust them.

```
// src/features/tracing/api.ts
export async function getTrace(id: string): Promise<TraceWithSpans> {
  const json = await apiFetch(`/admin/traces/${id}`);
  return traceWithSpansSchema.parse(json);  // ← single validation point
}
```

Schemas are null-tolerant where the backend may legitimately omit fields (`root_event`, `attributes`, `ended_at`, `status_message`). Fields the backend never sends as `null` (only omits) use `.optional()`, not `.nullable()`.

## Consequences

- A breaking backend change surfaces immediately at the call site with a clear Zod error, not as `undefined.foo` somewhere downstream.
- Components are simpler — they receive typed data and operate on it.
- Adding a new endpoint follows a fixed template: schema → inferred type → `api.ts` function → query hook. The pattern is mechanical; LLMs and humans both follow it without thinking.
- Don't re-validate Zod schemas inside components. If a component needs a narrower type, use TypeScript discriminated unions or a small derive function — not a second `.parse()`.
- Don't bypass validation with `as` casts. A `z.unknown()` field is the escape hatch for genuinely untyped backend blobs (raw event payloads, attribute maps); use it sparingly and let consumers narrow.
