"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { DollarSign } from "lucide-react";
import * as React from "react";
import type { AdminRateRow } from "../schemas";

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleDateString();
}

export type RatesTableProps = {
  rows: AdminRateRow[];
  isLoading: boolean;
  error: Error | null;
  onDeactivate: (id: string) => void;
  onRefresh: () => void;
};

export function RatesTable({ rows, isLoading, error, onDeactivate, onRefresh }: RatesTableProps) {
  const columns: DataTableColumn<AdminRateRow>[] = [
    {
      key: "resource",
      header: "Resource",
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-medium">{r.resource_name}</span>
          <span className="text-xs text-muted-foreground">{r.compute_allocation_resource_id}</span>
        </span>
      ),
    },
    {
      key: "cluster",
      header: "Cluster",
      cell: (r) => <span className="text-xs text-muted-foreground">{r.cluster_name}</span>,
    },
    {
      key: "rate",
      header: "Rate",
      align: "right",
      cell: (r) => <span className="font-mono tabular-nums">{r.rate.toFixed(3)}</span>,
    },
    {
      key: "from",
      header: "Effective from",
      cell: (r) => <span className="text-xs tabular-nums">{fmtDate(r.effective_from)}</span>,
    },
    {
      key: "to",
      header: "Effective to",
      cell: (r) => <span className="text-xs tabular-nums">{fmtDate(r.effective_to)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge
          variant={r.active ? "active" : "expired"}
          label={r.active ? "ACTIVE" : "EXPIRED"}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      interactive: true,
      cell: (r) => (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!r.active}
          onClick={(e) => {
            e.stopPropagation();
            onDeactivate(r.id);
          }}
        >
          Supersede
        </Button>
      ),
    },
  ];

  if (error) return <ErrorState message={error.message ?? "Failed to load rates"} onRetry={onRefresh} />;
  if (isLoading) return <TableSkeleton />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<DollarSign className="size-6" aria-hidden />}
        heading="No rates defined"
        description="Create a rate to charge SUs against this resource."
      />
    );
  }
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption={`${rows.length} rates`} />;
}
