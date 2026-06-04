"use client";

import {
  replaceShallowSearchParams,
  useShallowSearchParams,
} from "@/shared/hooks/useShallowSearchParams";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Button } from "@/shared/ui/button";
import * as React from "react";
import type { Span, WaterfallNode } from "../types";
import { buildParentKeyMap, buildSpanTree, computeSiblingP95, flattenTree } from "../utils";
import { TraceSpanDetailPanel } from "./TraceSpanDetailPanel";
import { TraceWaterfallRow } from "./TraceWaterfallRow";

export type TraceWaterfallTabProps = {
  spans: Span[];
  rootStart: string;
  rootEnd: string | null | undefined;
  scrollToSpanId?: string;
};

const MAX_DEPTH = 50;
const PAGE_SIZE = 200;
const HARD_CAP = 5000;

export function TraceWaterfallTab({
  spans,
  rootStart,
  rootEnd,
  scrollToSpanId,
}: TraceWaterfallTabProps) {
  const searchParams = useShallowSearchParams();
  const selectedSpan = searchParams.get("span");

  const tree = React.useMemo(() => buildSpanTree(spans, MAX_DEPTH), [spans]);
  const flat = React.useMemo(() => flattenTree(tree), [tree]);
  const siblingP95 = React.useMemo(() => computeSiblingP95(tree), [tree]);
  const parentKeyOf = React.useMemo(() => buildParentKeyMap(tree), [tree]);

  const rootStartMs = React.useMemo(() => Date.parse(rootStart), [rootStart]);
  const rootEndMs = React.useMemo(() => {
    if (rootEnd) {
      const v = Date.parse(rootEnd);
      if (Number.isFinite(v)) return v;
    }
    // Open trace: fall back to the latest span end (or root start) so the bar
    // axis still has a finite range.
    let max = rootStartMs;
    for (const s of spans) {
      const end = s.end_time ? Date.parse(s.end_time) : Date.parse(s.start_time);
      if (Number.isFinite(end) && end > max) max = end;
    }
    return max;
  }, [rootEnd, rootStartMs, spans]);

  const [revealed, setRevealed] = React.useState(PAGE_SIZE);
  const visibleCount = Math.min(revealed, flat.length, HARD_CAP);
  const visible = flat.slice(0, visibleCount);
  const remainingBeforeCap = Math.max(0, Math.min(flat.length, HARD_CAP) - visibleCount);
  const beyondCap = Math.max(0, flat.length - HARD_CAP);

  const rowRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const listRef = React.useRef<HTMLDivElement | null>(null);

  const setSelected = React.useCallback(
    (spanId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (spanId) params.set("span", spanId);
      else params.delete("span");
      replaceShallowSearchParams(params);
    },
    [searchParams],
  );

  // Honor an external scroll target (Phase 3 attempts strip "jump") on first
  // mount and whenever the prop changes; also writes the selection so the
  // detail panel opens on jump. selectedSpan/setSelected intentionally
  // omitted — re-triggering on URL ping-pong would loop with the replace above.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment
  React.useEffect(() => {
    if (!scrollToSpanId) return;
    const node = rowRefs.current.get(scrollToSpanId);
    if (node) node.scrollIntoView({ block: "nearest" });
    if (scrollToSpanId !== selectedSpan) setSelected(scrollToSpanId);
  }, [scrollToSpanId]);

  const selectedSpanObj = React.useMemo<Span | null>(() => {
    if (!selectedSpan) return null;
    return spans.find((s) => s.span_id === selectedSpan) ?? null;
  }, [selectedSpan, spans]);

  const onRowKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement | null;
      const currentId = target?.getAttribute("data-span-id");
      if (!currentId) return;
      const idx = visible.findIndex((n) => n.span.span_id === currentId);
      if (idx === -1) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = visible[Math.min(visible.length - 1, idx + 1)];
        if (next) {
          rowRefs.current.get(next.span.span_id)?.focus();
          setSelected(next.span.span_id);
        }
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = visible[Math.max(0, idx - 1)];
        if (prev) {
          rowRefs.current.get(prev.span.span_id)?.focus();
          setSelected(prev.span.span_id);
        }
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setSelected(currentId);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setSelected(null);
      }
    },
    [visible, setSelected],
  );

  if (spans.length === 0) {
    return <EmptyState heading="No spans in this trace." />;
  }

  return (
    <div className="space-y-3">
      <div
        ref={listRef}
        role="tree"
        aria-label="Span waterfall"
        onKeyDown={onRowKeyDown}
        className="space-y-0.5"
      >
        {visible.map((node) => (
          <React.Fragment key={node.span.span_id}>
            <TraceWaterfallRow
              ref={(el) => {
                if (el) rowRefs.current.set(node.span.span_id, el);
                else rowRefs.current.delete(node.span.span_id);
              }}
              span={node.span}
              depth={node.depth}
              rootStart={rootStartMs}
              rootEnd={rootEndMs}
              isSelected={node.span.span_id === selectedSpan}
              onSelect={setSelected}
              siblingP95={siblingP95.get(parentKeyOf.get(node.span.span_id) ?? "") ?? 0}
            />
            {node.collapsedCount > 0 ? (
              <CollapsedPill depth={node.depth + 1} count={node.collapsedCount} />
            ) : null}
          </React.Fragment>
        ))}
      </div>

      {remainingBeforeCap > 0 ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setRevealed((r) => Math.min(r + PAGE_SIZE, HARD_CAP, flat.length))}
        >
          +{remainingBeforeCap} more rows — Load more
        </Button>
      ) : null}

      {beyondCap > 0 ? (
        <p className="text-xs text-muted-foreground">+{beyondCap} more not shown</p>
      ) : null}

      <TraceSpanDetailPanel
        span={selectedSpanObj}
        rootStart={rootStart}
        open={selectedSpanObj != null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CollapsedPill({ depth, count }: { depth: number; count: number }) {
  return (
    <div className="text-xs text-muted-foreground" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
      +{count} collapsed
    </div>
  );
}
