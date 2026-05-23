import {
  createSavedViewPayloadSchema,
  personaSchema,
  updateSavedViewPayloadSchema,
} from "@features/analytics/views/schemas";
import { SAVED_VIEW_LIMIT_PER_PERSONA } from "@features/analytics/views/types";
import type { SavedView } from "@features/analytics/views/types";
import { http, HttpResponse } from "msw";
import { persistSeed, seed } from "../seed";
import { path } from "./_utils";

// Mirrors the convention in `users.ts` — caller id is read from the
// `x-nexus-user` header with a `?user=` query fallback, defaulting to
// the researcher persona. Documented in docs/backend-contracts/auth.md.
function currentUserId(request: Request): string {
  const url = new URL(request.url);
  return (
    url.searchParams.get("user") ??
    request.headers.get("x-nexus-user") ??
    "researcher@nexus.local"
  );
}

let nextSavedViewSeq = 1000;
function nextSavedViewId(): string {
  nextSavedViewSeq += 1;
  return `view-${nextSavedViewSeq}`;
}

// `is_default` is at most one per (user, persona). When the caller sets
// `is_default: true`, clear the flag on the user's other views in that
// persona so the invariant holds without a separate endpoint.
function clearOtherDefaults(userId: string, persona: SavedView["persona"], keepId?: string) {
  const now = new Date().toISOString();
  for (const v of seed.savedViews) {
    if (v.user_id !== userId) continue;
    if (v.persona !== persona) continue;
    if (v.id === keepId) continue;
    if (!v.is_default) continue;
    v.is_default = false;
    v.updated_at = now;
  }
}

export const analyticsViewsHandlers = [
  http.get(path("/analytics/views"), ({ request }) => {
    const userId = currentUserId(request);
    const url = new URL(request.url);
    const persona = url.searchParams.get("persona");
    const parsedPersona = personaSchema.safeParse(persona);
    if (!parsedPersona.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsedPersona.error.flatten() },
        { status: 400 },
      );
    }
    const rows = seed.savedViews
      .filter((v) => v.user_id === userId && v.persona === parsedPersona.data)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return HttpResponse.json(rows);
  }),

  http.post(path("/analytics/views"), async ({ request }) => {
    const userId = currentUserId(request);
    const body = await request.json();
    const parsed = createSavedViewPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const existing = seed.savedViews.filter(
      (v) => v.user_id === userId && v.persona === parsed.data.persona,
    );
    if (existing.length >= SAVED_VIEW_LIMIT_PER_PERSONA) {
      return HttpResponse.json({ error: "limit_reached" }, { status: 409 });
    }
    if (existing.some((v) => v.name === parsed.data.name)) {
      return HttpResponse.json({ error: "name_conflict" }, { status: 409 });
    }
    const now = new Date().toISOString();
    const view: SavedView = {
      id: nextSavedViewId(),
      user_id: userId,
      name: parsed.data.name,
      persona: parsed.data.persona,
      range: parsed.data.range,
      group_by: parsed.data.group_by,
      filters: parsed.data.filters ?? {},
      is_default: parsed.data.is_default ?? false,
      created_at: now,
      updated_at: now,
    };
    seed.savedViews.push(view);
    if (view.is_default) clearOtherDefaults(userId, view.persona, view.id);
    persistSeed();
    return HttpResponse.json(view, { status: 201 });
  }),

  http.put(path("/analytics/views/:id"), async ({ params, request }) => {
    const userId = currentUserId(request);
    const id = String(params.id);
    const view = seed.savedViews.find((v) => v.id === id);
    if (!view) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    if (view.user_id !== userId) {
      return HttpResponse.json({ error: "forbidden" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = updateSavedViewPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (parsed.data.name !== undefined) {
      const conflict = seed.savedViews.find(
        (v) =>
          v.user_id === userId &&
          v.persona === view.persona &&
          v.id !== view.id &&
          v.name === parsed.data.name,
      );
      if (conflict) {
        return HttpResponse.json({ error: "name_conflict" }, { status: 409 });
      }
      view.name = parsed.data.name;
    }
    if (parsed.data.is_default !== undefined) {
      view.is_default = parsed.data.is_default;
      if (view.is_default) clearOtherDefaults(userId, view.persona, view.id);
    }
    view.updated_at = new Date().toISOString();
    persistSeed();
    return HttpResponse.json(view);
  }),

  http.delete(path("/analytics/views/:id"), ({ params, request }) => {
    const userId = currentUserId(request);
    const id = String(params.id);
    const idx = seed.savedViews.findIndex((v) => v.id === id);
    if (idx === -1) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const view = seed.savedViews[idx];
    if (!view) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    if (view.user_id !== userId) {
      return HttpResponse.json({ error: "forbidden" }, { status: 403 });
    }
    seed.savedViews.splice(idx, 1);
    persistSeed();
    return new HttpResponse(null, { status: 204 });
  }),
];
