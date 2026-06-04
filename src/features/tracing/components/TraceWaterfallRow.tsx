"use client";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import * as React from "react";
import type { Span } from "../types";
import { getSpanKindLabel } from "../types";
import { formatDurationMs, shortHex } from "../utils";

export type WaterfallRowProps = {
  span: Span;
  depth: number;
  rootStart: number;
  rootEnd: number;
  isSelected: boolean;
  onSelect: (spanId: string) => void;
  siblingP95: number;
};

const NAME_TRUNCATE = 40;
const INDENT_PX = 16;

// Bar fill follows the spec §2 item 9 color story: failed=red, ok=neutral
// gray (brand-blue reserved per styling-alignment), complete=green, retry/slow
// indicator=amber. Status 2 (cancelled) and 3 (orphaned) fall back to neutral.
function barFillVar(status: number): string {
  if (status === 1) return "var(--nexus-red-500)";
  if (status === 0) return "var(--nexus-gray-400)";
  return "var(--nexus-gray-300)";
}

function statusDotClass(status: number): string {
  if (status === 1) return "bg-[color:var(--nexus-red-500)]";
  if (status === 0) return "bg-[color:var(--nexus-green-500)]";
  if (status === 3) return "bg-[color:var(--nexus-amber-500)]";
  return "bg-muted-foreground";
}

export const TraceWaterfallRow = React.forwardRef<HTMLDivElement, WaterfallRowProps>(
  function TraceWaterfallRow(
    { span, depth, rootStart, rootEnd, isSelected, onSelect, siblingP95 },
    ref,
  ) {
    const startMs = Date.parse(span.start_time);
    const endMs = span.end_time ? Date.parse(span.end_time) : startMs;
    const durationMs = Math.max(0, endMs - startMs);
    const range = Math.max(1, rootEnd - rootStart);
    const offsetMs = Math.max(0, startMs - rootStart);
    const leftPct = clamp01((offsetMs / range) * 100);
    const widthPct = Math.max(0.5, clamp01((durationMs / range) * 100));
    const slow = siblingP95 > 0 && durationMs > siblingP95;

    const displayName =
      span.name.length > NAME_TRUNCATE ? `${span.name.slice(0, NAME_TRUNCATE)}…` : span.name;

    return (
      <div
        ref={ref}
        role="treeitem"
        aria-selected={isSelected}
        aria-level={depth + 1}
        // role="treeitem" makes the div the keyboard focus target for tree
        // semantics; tabIndex=0 is required for arrow-key nav across rows.
        // biome-ignore lint/a11y/noNoninteractiveTabindex: see comment
        tabIndex={0}
        data-span-id={span.span_id}
        onClick={() => onSelect(span.span_id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(span.span_id);
          }
        }}
        className={cn(
          "grid cursor-pointer grid-cols-[minmax(180px,1.2fr)_minmax(160px,2fr)_auto] items-center gap-3 rounded-md px-2 py-1.5 text-xs",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected ? "bg-muted/60" : "hover:bg-muted/30",
        )}
        style={{ paddingLeft: `${depth * INDENT_PX + 8}px` }}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            aria-hidden="true"
            className={cn("inline-block size-2 shrink-0 rounded-full", statusDotClass(span.status))}
          />
          <Tooltip>
            <TooltipTrigger
              render={<span className="truncate font-medium text-foreground">{displayName}</span>}
            />
            <TooltipContent>{span.name}</TooltipContent>
          </Tooltip>
        </div>

        <div className="relative h-4 w-full rounded bg-muted/40">
          <span
            aria-hidden="true"
            className="absolute top-0 h-4 rounded"
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              backgroundColor: barFillVar(span.status),
            }}
          />
          {slow ? (
            <span
              aria-label="Slow span"
              title="Slower than sibling P95"
              className="absolute top-0 h-4 w-1 rounded-r bg-[color:var(--nexus-amber-500)]"
              style={{ left: `calc(${leftPct + widthPct}% - 2px)` }}
            />
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-3 tabular-nums text-muted-foreground">
          <span>{Math.round(offsetMs)}ms</span>
          <span className="text-foreground">{formatDurationMs(durationMs)}</span>
          <span className="font-mono">{shortHex(span.span_id, 8)}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">
            {getSpanKindLabel(span.kind)}
          </span>
        </div>
      </div>
    );
  },
);

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return v;
}
