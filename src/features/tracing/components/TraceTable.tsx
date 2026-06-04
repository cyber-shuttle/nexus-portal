"use client";

import { cn } from "@/lib/utils";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import * as React from "react";
import type { Trace } from "../types";
import { STATUS_TO_BADGE, getTraceStatusInfo } from "../types";
import {
  copyTraceId,
  durationBetween,
  formatAbsoluteUtc,
  formatDurationMs,
  formatRelative,
  shortHex,
} from "../utils";

const MAX_OFFSET = 1_000_000;
const ROOT_NAME_MAX_CHARS = 40;

export type TraceTableProps = {
  traces: Trace[];
  total: number;
  limit: number;
  offset: number;
  loading: boolean;
  hasFilters: boolean;
  error: Error | null;
  onPageChange: (nextOffset: number) => void;
  onView: (traceId: string) => void;
  onRetry: () => void;
};

export function TraceTable({
  traces,
  total,
  limit,
  offset,
  loading,
  hasFilters,
  error,
  onPageChange,
  onView,
  onRetry,
}: TraceTableProps) {
  if (loading) {
    const skelKeys = ["a", "b", "c", "d", "e"];
    return (
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        {skelKeys.map((k) => (
          <Skeleton key={`trace-row-skel-${k}`} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error.message ?? "Failed to load traces."} onRetry={onRetry} />;
  }

  if (traces.length === 0) {
    return hasFilters ? (
      <EmptyState heading="No traces match these filters." />
    ) : (
      <EmptyState
        heading="No traces yet."
        description="Once activity starts, flows will appear here."
      />
    );
  }

  // One baseline per render so every row's relative time uses the same anchor.
  const now = Date.now();

  const columns: DataTableColumn<Trace>[] = [
    {
      key: "started",
      header: "Started",
      sortable: true,
      sortValue: (row) => new Date(row.started_at),
      cell: (row) => (
        <Tooltip>
          <TooltipTrigger
            render={
              <span className="cursor-help text-xs text-muted-foreground tabular-nums">
                {formatRelative(row.started_at, now)}
              </span>
            }
          />
          <TooltipContent>{formatAbsoluteUtc(row.started_at)}</TooltipContent>
        </Tooltip>
      ),
    },
    {
      key: "trace_id",
      header: "Trace ID",
      interactive: true,
      cell: (row) => (
        <button
          type="button"
          aria-label={`Copy trace ID ${row.trace_id}`}
          onClick={(e) => {
            e.stopPropagation();
            void copyTraceId(row.trace_id);
          }}
          className="rounded-sm font-mono text-sm text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {shortHex(row.trace_id, 8)}…
        </button>
      ),
    },
    {
      key: "root_name",
      header: "Root operation",
      sortable: true,
      sortValue: (row) => row.root_name,
      cell: (row) => (
        <span className="text-sm" title={row.root_name}>
          {truncate(row.root_name, ROOT_NAME_MAX_CHARS)}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      sortable: true,
      sortValue: (row) => row.source,
      cell: (row) => <span className="text-xs text-muted-foreground">{row.source}</span>,
    },
    {
      key: "duration",
      header: "Duration",
      sortable: true,
      sortValue: (row) => durationBetween(row.started_at, row.ended_at ?? null),
      cell: (row) => {
        const ms = durationBetween(row.started_at, row.ended_at ?? null);
        return (
          <span className="text-xs tabular-nums">{ms == null ? "—" : formatDurationMs(ms)}</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => row.status,
      cell: (row) => {
        const info = getTraceStatusInfo(row.status);
        return (
          <StatusBadge variant={STATUS_TO_BADGE[row.status] ?? "inactive"} label={info.label} />
        );
      },
    },
    {
      key: "view",
      header: "",
      align: "right",
      interactive: true,
      cell: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onView(row.trace_id);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  // Backend hard-caps offset at 1,000,000; mirror it defensively so the user
  // never paints a 400 by clicking Next at the edge.
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const nextOffset = offset + limit;
  const nextBlocked = nextOffset > MAX_OFFSET;

  return (
    <DataTable
      columns={columns}
      rows={traces}
      rowKey={(row) => row.trace_id}
      pagination={{
        page,
        pageSize: limit,
        total,
        nextDisabled: nextBlocked,
        onPageChange: (next) => {
          const candidate = (next - 1) * limit;
          if (candidate > MAX_OFFSET) return;
          if (nextBlocked && next > page) return;
          onPageChange(candidate);
        },
      }}
      className={cn(totalPages === 1 ? "[&_[data-pager]]:hidden" : undefined)}
    />
  );
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
