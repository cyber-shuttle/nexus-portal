"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ChevronDown, ShieldCheck } from "lucide-react";
import * as React from "react";
import type { AdminResourceRow } from "../schemas";

export type ResourcesTableProps = {
  rows: AdminResourceRow[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  clusterFilter: string;
  statusFilter: string;
  q: string;
  clusters: Array<{ id: string; name: string }>;
  onClusterChange: (next: string) => void;
  onStatusChange: (next: string) => void;
  onQueryChange: (next: string) => void;
  onRowClick: (row: AdminResourceRow) => void;
  onRetry: () => void;
};

export function ResourcesTable({
  rows,
  total,
  isLoading,
  error,
  clusterFilter,
  statusFilter,
  q,
  clusters,
  onClusterChange,
  onStatusChange,
  onQueryChange,
  onRowClick,
  onRetry,
}: ResourcesTableProps) {
  const [draft, setDraft] = React.useState(q);
  React.useEffect(() => setDraft(q), [q]);

  const columns: DataTableColumn<AdminResourceRow>[] = [
    {
      key: "name",
      header: "Resource",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.name}</span>
          <span className="text-xs text-muted-foreground">{r.resource_type}</span>
        </span>
      ),
    },
    {
      key: "cluster",
      header: "Cluster",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.cluster_name}</span>,
    },
    {
      key: "allocs",
      header: "Allocations",
      align: "right",
      cell: (r) => <span className="tabular-nums">{r.allocation_count}</span>,
    },
    {
      key: "allocated",
      header: "Allocated SU",
      align: "right",
      cell: (r) => <span className="tabular-nums">{r.total_allocated_su.toLocaleString()}</span>,
    },
    {
      key: "used",
      header: "Used SU",
      align: "right",
      cell: (r) => <span className="tabular-nums">{r.total_used_su.toLocaleString()}</span>,
    },
    {
      key: "usage",
      header: "Used %",
      cell: (r) => {
        const isOver = r.used_pct > 100;
        const tooltip = isOver
          ? `Over-utilized: ${r.used_pct.toFixed(1)}% (accounting lag — bar clips at 100%)`
          : `${r.used_pct.toFixed(1)}% used`;
        return (
          <div className="w-40" title={tooltip}>
            <UsageBar
              value={r.total_used_su}
              max={Math.max(1, r.total_allocated_su)}
              label={`${r.used_pct.toFixed(1)}%`}
              ariaLabel={`${r.name} usage ${r.used_pct.toFixed(1)} percent`}
              size="sm"
            />
          </div>
        );
      },
    },
    {
      key: "rates",
      header: "Rates",
      align: "right",
      cell: (r) => <span className="tabular-nums">{r.rate_count}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge
          variant={r.status === "ACTIVE" ? "active" : "inactive"}
          label={r.status}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onQueryChange(draft);
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="res-cluster">Cluster</Label>
          <div className="relative">
            <select
              id="res-cluster"
              className="appearance-none rounded-md border bg-background pl-3 pr-8 py-1.5 text-sm"
              value={clusterFilter}
              onChange={(e) => onClusterChange(e.currentTarget.value)}
            >
              <option value="">All clusters</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="res-status">Status</Label>
          <div className="relative">
            <select
              id="res-status"
              className="appearance-none rounded-md border bg-background pl-3 pr-8 py-1.5 text-sm"
              value={statusFilter}
              onChange={(e) => onStatusChange(e.currentTarget.value)}
            >
              <option value="">All</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="res-q">Search</Label>
          <Input
            id="res-q"
            type="search"
            placeholder="Resource name or type"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            className="w-56"
          />
        </div>
      </form>

      {error ? (
        <ErrorState message={error.message ?? "Failed to load resources"} onRetry={onRetry} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="size-6" aria-hidden />}
          heading="No resources match these filters"
          description="Try widening the filter or clearing the search."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={onRowClick}
          caption={`${total} resource${total === 1 ? "" : "s"}`}
        />
      )}
    </div>
  );
}
