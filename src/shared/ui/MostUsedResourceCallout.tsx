"use client";

import { cn } from "@/lib/utils";
import { DrillStack } from "@/shared/ui/DrillStack";
import { Cpu } from "lucide-react";
import * as React from "react";

// Promoted from `features/projects/components/` in TF3 so allocation detail +
// the analytics Resources tab can reuse the same visual without crossing the
// §5 feature-isolation rule. Stays pure-presentational — callers compute the
// rows from whatever their domain query returns.

export type MostUsedResourceCalloutRow = {
  id: string;
  name: string;
  used_su: number;
  share_pct: number;
};

export type MostUsedResourceCalloutProps = {
  resources: MostUsedResourceCalloutRow[];
  topN?: number;
  onRowClick?: (row: MostUsedResourceCalloutRow) => void;
};

function formatSU(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}

export function MostUsedResourceCallout({
  resources,
  topN = 5,
  onRowClick,
}: MostUsedResourceCalloutProps) {
  // Sort by share desc so a caller can pass an unsorted list. We tiebreak on
  // raw SUs so two equal-share resources order by absolute weight.
  const sorted = React.useMemo(
    () =>
      [...resources].sort((a, b) =>
        b.share_pct !== a.share_pct ? b.share_pct - a.share_pct : b.used_su - a.used_su,
      ),
    [resources],
  );
  const top = sorted.slice(0, topN);

  const [drillRow, setDrillRow] = React.useState<MostUsedResourceCalloutRow | null>(null);

  if (top.length === 0) {
    return (
      <section
        aria-label="Most-used resources"
        className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground"
      >
        No resource usage yet for this window.
      </section>
    );
  }

  return (
    <section
      aria-label="Most-used resources"
      className="space-y-3 rounded-lg border border-border bg-card p-5"
    >
      <header className="flex items-center gap-2">
        <Cpu className="h-4 w-4 text-brand" aria-hidden />
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Most-used resources
        </h3>
      </header>
      <ol className="space-y-2">
        {top.map((row, i) => {
          const pct = Math.max(0, Math.min(100, row.share_pct));
          return (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => {
                  if (onRowClick) {
                    onRowClick(row);
                    return;
                  }
                  setDrillRow(row);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left",
                  "hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                )}
              >
                <span className="w-5 text-xs tabular-nums text-muted-foreground">
                  {i + 1}.
                </span>
                <span className="min-w-[140px] flex-shrink-0 truncate text-sm font-medium text-foreground">
                  {row.name}
                </span>
                <span
                  className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-brand"
                    style={{ width: `${pct}%` }}
                  />
                </span>
                <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                  {pct.toFixed(0)}%
                </span>
                <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                  {formatSU(row.used_su)} SU
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Built-in DrillStack is the fallback when the caller doesn't intercept
          via `onRowClick` — keeps the project Resource Usage tab interactive
          without forcing every consumer to wire a drawer. Analytics + the
          allocation detail surface skip this branch entirely. */}
      <DrillStack
        open={!onRowClick && drillRow !== null}
        title={drillRow ? `Resource: ${drillRow.name}` : "Resource"}
        crumbs={[]}
        onClose={() => setDrillRow(null)}
      >
        <p className="text-sm text-muted-foreground">
          Open the analytics Resources tab for the per-user and per-allocation breakdown.
        </p>
      </DrillStack>
    </section>
  );
}
