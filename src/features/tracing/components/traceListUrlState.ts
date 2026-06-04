import { DEFAULT_FILTERS, type ListFilters, type WindowPreset } from "./TraceFilterStrip";

// Hardcoded whitelists keep parseFilters tolerant of pasted/manipulated URLs:
// stray status=999 or source=foo would otherwise widen the query key and miss
// the cache; bounded enums collapse them to defaults instead.
const VALID_PRESETS: WindowPreset[] = ["24h", "7d", "30d", "custom"];
const VALID_STATUS = new Set<number>([0, 1, 2, 3]);
const VALID_SOURCES = new Set<string>(["amie", "http", "comanage", "slurm"]);
const DAY_MS = 24 * 60 * 60 * 1000;

// Narrow surface so both Next's ReadonlyURLSearchParams and the global
// URLSearchParams satisfy the input contract for parseFilters.
export type SearchParamsLike = {
  getAll: (key: string) => string[];
  get: (key: string) => string | null;
};

export function parseFilters(params: SearchParamsLike): ListFilters {
  const status = params
    .getAll("status")
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isFinite(n) && VALID_STATUS.has(n));
  const source = params.getAll("source").filter((s) => VALID_SOURCES.has(s));
  const presetRaw = params.get("preset");
  const preset: WindowPreset = VALID_PRESETS.includes(presetRaw as WindowPreset)
    ? (presetRaw as WindowPreset)
    : "30d";
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  const q = params.get("q") ?? "";
  const limitRaw = Number.parseInt(params.get("limit") ?? "", 10);
  const offsetRaw = Number.parseInt(params.get("offset") ?? "", 10);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 50;
  const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
  return { status, source, preset, from, to, q, limit, offset };
}

export function serializeFilters(f: ListFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const s of [...f.status].sort((a, b) => a - b)) {
    params.append("status", String(s));
  }
  for (const src of [...f.source].sort()) {
    params.append("source", src);
  }
  if (f.preset !== "30d") params.set("preset", f.preset);
  if (f.preset === "custom") {
    if (f.from) params.set("from", f.from);
    if (f.to) params.set("to", f.to);
  }
  if (f.q) params.set("q", f.q);
  if (f.limit !== 50) params.set("limit", String(f.limit));
  if (f.offset !== 0) params.set("offset", String(f.offset));
  return params;
}

export function computeWindow(filters: ListFilters, now: number): { from?: string; to?: string } {
  if (filters.preset === "custom") {
    return { from: filters.from, to: filters.to };
  }
  const days = filters.preset === "24h" ? 1 : filters.preset === "7d" ? 7 : 30;
  return { from: new Date(now - days * DAY_MS).toISOString() };
}

export function hasActiveFilters(f: ListFilters): boolean {
  return (
    f.status.length > 0 ||
    f.source.length > 0 ||
    f.q.length > 0 ||
    f.preset !== "30d" ||
    Boolean(f.from) ||
    Boolean(f.to)
  );
}

export { DEFAULT_FILTERS };
