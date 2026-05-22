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
