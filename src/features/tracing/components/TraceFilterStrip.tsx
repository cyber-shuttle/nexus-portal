"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useDebounce } from "@shared/hooks/useDebounce";
import * as React from "react";
import { TRACE_SOURCES, getTraceStatusInfo } from "../types";

export type WindowPreset = "24h" | "7d" | "30d" | "custom";

export type ListFilters = {
  status: number[];
  source: string[];
  preset: WindowPreset;
  from?: string;
  to?: string;
  q: string;
  limit: number;
  offset: number;
};

export const DEFAULT_FILTERS: ListFilters = {
  status: [],
  source: [],
  preset: "30d",
  q: "",
  limit: 50,
  offset: 0,
};

const STATUS_VALUES: number[] = [0, 1, 2, 3];
const WINDOW_PRESETS: WindowPreset[] = ["24h", "7d", "30d", "custom"];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 365;

// Chip variant per status — mirrors StatusBadge tokens (token-only, never
// raw bg-nexus-*-NNN) and the styling-alignment status color map.
const STATUS_CHIP_STYLES: Record<number, string> = {
  0: "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)]",
  1: "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)]",
  2: "bg-muted text-muted-foreground",
  3: "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)]",
};

export type TraceFilterStripProps = {
  value: ListFilters;
  onChange: (next: ListFilters) => void;
};

export function TraceFilterStrip({ value, onChange }: TraceFilterStripProps) {
  const [searchDraft, setSearchDraft] = React.useState(value.q);
  const debouncedSearch = useDebounce(searchDraft, 300);
  const latestRef = React.useRef({ value, onChange });
  latestRef.current = { value, onChange };

  // Only push debounced text through when it differs from the URL — avoids a
  // redundant render loop on parent-driven `value.q` changes.
  React.useEffect(() => {
    const { value: latest, onChange: latestOnChange } = latestRef.current;
    if (debouncedSearch !== latest.q) {
      latestOnChange({ ...latest, q: debouncedSearch, offset: 0 });
    }
  }, [debouncedSearch]);

  React.useEffect(() => {
    setSearchDraft(value.q);
  }, [value.q]);

  function toggleStatus(s: number) {
    const next = value.status.includes(s)
      ? value.status.filter((x) => x !== s)
      : [...value.status, s];
    onChange({ ...value, status: next, offset: 0 });
  }

  function toggleSource(src: string) {
    const next = value.source.includes(src)
      ? value.source.filter((x) => x !== src)
      : [...value.source, src];
    onChange({ ...value, source: next, offset: 0 });
  }

  function pickPreset(preset: WindowPreset) {
    if (preset === "custom") {
      onChange({ ...value, preset: "custom", offset: 0 });
      return;
    }
    onChange({ ...value, preset, from: undefined, to: undefined, offset: 0 });
  }

  const isCustom = value.preset === "custom";
  const rangeDays = React.useMemo(() => {
    if (!isCustom || !value.from || !value.to) return 0;
    const f = Date.parse(value.from);
    const t = Date.parse(value.to);
    if (Number.isNaN(f) || Number.isNaN(t)) return 0;
    return Math.max(0, Math.round((t - f) / DAY_MS));
  }, [isCustom, value.from, value.to]);
  const rangeTooLong = isCustom && rangeDays > MAX_RANGE_DAYS;

  function setCustomFrom(iso: string) {
    if (!iso) {
      onChange({ ...value, from: undefined, offset: 0 });
      return;
    }
    onChange({ ...value, preset: "custom", from: toUtcIso(iso), offset: 0 });
  }

  function setCustomTo(iso: string) {
    if (!iso) {
      onChange({ ...value, to: undefined, offset: 0 });
      return;
    }
    // Anchor the `to` bound to end-of-day so the same calendar day is included.
    onChange({ ...value, preset: "custom", to: toUtcIso(iso, true), offset: 0 });
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_VALUES.map((s) => {
              const info = getTraceStatusInfo(s);
              const active = value.status.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleStatus(s)}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? STATUS_CHIP_STYLES[s]
                      : "bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {info.label.toLowerCase()}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Source
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {TRACE_SOURCES.map((src) => {
              const active = value.source.includes(src);
              return (
                <button
                  key={src}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleSource(src)}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {src}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Window
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {WINDOW_PRESETS.map((preset) => {
              const active = value.preset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickPreset(preset)}
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "bg-foreground text-background"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {preset}
                </button>
              );
            })}
          </div>
        </fieldset>

        {isCustom ? (
          <div className="flex items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="trace-from" className="text-xs">
                From
              </Label>
              <input
                id="trace-from"
                type="date"
                value={isoToDateInput(value.from)}
                onChange={(e) => setCustomFrom(e.currentTarget.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="trace-to" className="text-xs">
                To
              </Label>
              <input
                id="trace-to"
                type="date"
                value={isoToDateInput(value.to)}
                onChange={(e) => setCustomTo(e.currentTarget.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
              />
            </div>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
          <Label htmlFor="trace-search" className="text-xs">
            Search
          </Label>
          <Input
            id="trace-search"
            type="search"
            placeholder="trace_id, span_id, or operation"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.currentTarget.value)}
          />
        </div>
      </div>

      {rangeTooLong ? (
        <p role="alert" className="mt-3 text-xs text-[color:var(--nexus-red-700)]">
          Date range cannot exceed 365 days.
        </p>
      ) : null}
    </div>
  );
}

// `<input type="date">` writes `YYYY-MM-DD`; serialize at UTC midnight (or
// end-of-day for the upper bound) so the wire format matches §3.3 ISO usage.
function toUtcIso(date: string, endOfDay = false): string {
  const suffix = endOfDay ? "T23:59:59.999Z" : "T00:00:00.000Z";
  return `${date}${suffix}`;
}

function isoToDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
