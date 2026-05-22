"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import * as React from "react";

export type DataTableColumn<T> = {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
  // Set true when the cell already renders its own interactive control (a
  // checkbox, a button, a link). The DataTable will then skip wrapping the cell
  // in its keyboard-activation <button>, which would otherwise nest controls.
  interactive?: boolean;
};

export type DataTablePagination = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export type DataTableProps<T> = {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  rowKey: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  caption?: string;
  empty?: React.ReactNode;
  pagination?: DataTablePagination;
  className?: string;
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  caption,
  empty,
  pagination,
  className,
}: DataTableProps<T>) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "px-4 py-3 font-medium",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  {empty ?? <span className="text-sm text-muted-foreground">No data.</span>}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  // Row hover bg removed per spec §7.6 — the keyboard target
                  // inside the first cell provides the affordance instead.
                  className={cn(
                    "border-t border-border/60 bg-card",
                    onRowClick && "cursor-pointer",
                  )}
                  onClick={
                    onRowClick
                      ? (e) => {
                          // Ignore clicks on interactive children (buttons,
                          // checkboxes, links) — they have their own handlers.
                          const target = e.target as HTMLElement;
                          if (target.closest("button, a, input, select, textarea, label")) return;
                          onRowClick(row);
                        }
                      : undefined
                  }
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" && e.target === e.currentTarget) {
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                >
                  {(() => {
                    const firstWrappable = onRowClick
                      ? columns.findIndex((c) => !c.interactive)
                      : -1;
                    return columns.map((col, ci) => {
                      const wrap = ci === firstWrappable;
                      const content = col.cell(row, index);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3 align-middle text-sm text-foreground",
                            col.align === "right" && "text-right",
                            col.align === "center" && "text-center",
                          )}
                        >
                          {wrap ? (
                            // Keyboard-accessible target for row-level
                            // activation: a real <button> avoids the
                            // nested-interactive a11y warning that
                            // `role="button"` on the <tr> caused.
                            <button
                              type="button"
                              className="-mx-1 inline-flex items-center rounded-sm bg-transparent px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRowClick?.(row);
                              }}
                            >
                              {content}
                            </button>
                          ) : (
                            content
                          )}
                        </td>
                      );
                    });
                  })()}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination ? <DataTablePager pagination={pagination} /> : null}
    </div>
  );
}

function DataTablePager({ pagination }: { pagination: DataTablePagination }) {
  const { page, pageSize, total, onPageChange } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between border-t border-border/60 bg-card px-4 py-3 text-xs text-muted-foreground">
      <span>
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          Previous
        </Button>
        {/* Active page renders as solid primary (near-black) to match the
            collaborator's tables; sibling prev/next are outlined. */}
        <span
          aria-current="page"
          className="inline-flex h-8 min-w-8 items-center justify-center rounded-md bg-primary px-3 text-[0.8rem] font-semibold text-primary-foreground"
        >
          {page}
        </span>
        <span className="text-muted-foreground">of {totalPages}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
