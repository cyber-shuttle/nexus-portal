import { seed } from "../seed";

export const API_BASE = "/api/v1";

export function path(suffix: string): string {
  return `${API_BASE}${suffix}`;
}

export function paginate<T>(items: T[], url: URL): T[] {
  const limit = Number(url.searchParams.get("limit") ?? "0");
  const offset = Number(url.searchParams.get("offset") ?? "0");
  if (!limit) return items.slice(offset);
  return items.slice(offset, offset + limit);
}

// OIDC-signed-in users carry UUIDs that don't match any seed persona, so
// per-user filters return empty. Alias unknowns to pi@nexus.local (richest seed)
// so the alpha stakeholders see realistic data. Dev personas pass through.
const FALLBACK_PERSONA_ID = "pi@nexus.local";

export function aliasUserId(id: string | null | undefined): string {
  if (!id) return FALLBACK_PERSONA_ID;
  return seed.users.some((u) => u.id === id) ? id : FALLBACK_PERSONA_ID;
}
