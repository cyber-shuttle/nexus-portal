"use client";

import { cn } from "@/lib/utils";

export type ComplianceBand = "ok" | "warn" | "hot" | "empty";

export type ComplianceCell = {
  value: number;
  band: ComplianceBand;
};

export type ComplianceMatrixProps<R, C> = {
  rows: R[];
  cols: C[];
  rowLabel: (r: R) => string;
  colLabel: (c: C) => string;
  cell: (r: R, c: C) => ComplianceCell | null;
  onCellClick?: (r: R, c: C) => void;
  /** Render a value into the cell. Defaults to `value.toFixed(0) + "%"` for ratios. */
  formatValue?: (cell: ComplianceCell, r: R, c: C) => string;
  className?: string;
  caption?: string;
};

// Token-arbitrary tints are the agreed exception (spec §7.6) — none of the
// semantic colors map to a 4-band heatmap so we go straight to the design
// tokens via `bg-[color:var(...)]`. Documented in A0 gate report.
const bandStyles: Record<ComplianceBand, string> = {
  ok: "bg-[color:var(--nexus-green-100)] text-[color:var(--nexus-green-700)]",
  warn: "bg-[color:var(--nexus-amber-100)] text-[color:var(--nexus-amber-700)]",
  hot: "bg-[color:var(--nexus-red-100)] text-[color:var(--nexus-red-700)]",
  empty: "bg-muted text-muted-foreground",
};

function defaultFormat(cell: ComplianceCell): string {
  if (cell.band === "empty") return "—";
  return `${Math.round(cell.value * 100)}%`;
}

export function ComplianceMatrix<R, C>({
  rows,
  cols,
  rowLabel,
  colLabel,
  cell,
  onCellClick,
  formatValue = defaultFormat,
  className,
  caption,
}: ComplianceMatrixProps<R, C>) {
  return (
    <div className={cn("relative overflow-x-auto", className)}>
      <table className="w-full border-collapse text-xs">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {/* Sticky-left corner cell must outrank the body sticky-left to keep
                the header row + label column corner clean on scroll. */}
            <th
              scope="col"
              className="sticky left-0 z-10 bg-card p-2 text-left font-medium text-muted-foreground"
            />
            {cols.map((c, ci) => (
              <th
                // biome-ignore lint/suspicious/noArrayIndexKey: cols may not be primitives
                key={ci}
                scope="col"
                className="p-2 text-left font-medium text-muted-foreground"
              >
                {colLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows may not be primitives
            <tr key={ri}>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-card p-2 text-left font-medium text-foreground"
              >
                {rowLabel(r)}
              </th>
              {cols.map((c, ci) => {
                const data = cell(r, c);
                const band: ComplianceBand = data?.band ?? "empty";
                const value = data ?? { value: 0, band: "empty" as const };
                const text = data ? formatValue(value, r, c) : "—";
                const ariaLabel = `${rowLabel(r)} — ${colLabel(c)}: ${text}`;
                const clickable = Boolean(onCellClick);
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: cols may not be primitives
                  <td key={ci} className="p-1">
                    {clickable ? (
                      <button
                        type="button"
                        onClick={() => onCellClick?.(r, c)}
                        aria-label={ariaLabel}
                        className={cn(
                          "block w-full rounded-md px-2 py-2 text-right text-xs tabular-nums transition-colors hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          bandStyles[band],
                        )}
                        data-band={band}
                      >
                        {text}
                      </button>
                    ) : (
                      <div
                        aria-label={ariaLabel}
                        className={cn(
                          "rounded-md px-2 py-2 text-right text-xs tabular-nums",
                          bandStyles[band],
                        )}
                        data-band={band}
                      >
                        {text}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
