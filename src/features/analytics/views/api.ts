import { apiFetch } from "@shared/api/client";
import type { AnalyticsPersona } from "@shared/auth/personaForAnalytics";
import { savedViewListSchema, savedViewSchema } from "./schemas";
import type {
  CreateSavedViewPayload,
  SavedView,
  UpdateSavedViewPayload,
} from "./types";

// Endpoint shapes are documented in docs/backend-contracts/analytics.md.
// The MSW handler keys ownership on `x-nexus-user` / `?user=`; the real
// backend will key on the bearer token.

const BASE = "/analytics/views";

function userQuery(userId: string | null): string {
  // MSW dev convention — pass the user id as a fallback query param so
  // SSR / non-browser callers without the auth header still resolve to the
  // correct owner. Documented in docs/backend-contracts/auth.md.
  if (!userId) return "";
  const params = new URLSearchParams({ user: userId });
  return `?${params.toString()}`;
}

export async function getSavedViews(
  persona: AnalyticsPersona,
  userId: string | null = null,
): Promise<SavedView[]> {
  const params = new URLSearchParams({ persona });
  if (userId) params.set("user", userId);
  const raw = await apiFetch(`${BASE}?${params.toString()}`);
  return savedViewListSchema.parse(raw ?? []);
}

export async function createSavedView(
  payload: CreateSavedViewPayload,
  userId: string | null = null,
): Promise<SavedView> {
  const raw = await apiFetch(`${BASE}${userQuery(userId)}`, {
    method: "POST",
    body: payload,
  });
  return savedViewSchema.parse(raw);
}

export async function updateSavedView(
  id: string,
  payload: UpdateSavedViewPayload,
  userId: string | null = null,
): Promise<SavedView> {
  const raw = await apiFetch(`${BASE}/${encodeURIComponent(id)}${userQuery(userId)}`, {
    method: "PUT",
    body: payload,
  });
  return savedViewSchema.parse(raw);
}

export async function deleteSavedView(
  id: string,
  userId: string | null = null,
): Promise<void> {
  await apiFetch(`${BASE}/${encodeURIComponent(id)}${userQuery(userId)}`, {
    method: "DELETE",
  });
}
