"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { ChevronDown, Coins } from "lucide-react";
import * as React from "react";
import type { Adjustment, AdjustmentType } from "../schemas";

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

function adjustmentVariant(type: AdjustmentType) {
  if (type === "CREDIT") return "approved";
  if (type === "DEBIT") return "rejected";
  return "warning";
}

export type AdjustmentsTableProps = {
  rows: Adjustment[];
  isLoading: boolean;
  error: Error | null;
  typeFilter: AdjustmentType | "all";
  onTypeChange: (t: AdjustmentType | "all") => void;
  onRefresh: () => void;
};

export function AdjustmentsTable({
  rows,
  isLoading,
  error,
  typeFilter,
  onTypeChange,
  onRefresh,
}: AdjustmentsTableProps) {
  const columns: DataTableColumn<Adjustment>[] = [
    {
      key: "alloc",
      header: "Allocation",
      cell: (a) => (
        <span className="flex flex-col">
          <span className="font-medium">{a.allocation_name}</span>
          <span className="text-xs text-muted-foreground">{a.allocation_id}</span>
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (a) => <StatusBadge variant={adjustmentVariant(a.type)} label={a.type} />,
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (a) => <span className="tabular-nums">{a.amount.toLocaleString()} SU</span>,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (a) => <span className="text-xs text-muted-foreground">{a.reason}</span>,
    },
    {
      key: "by",
      header: "By",
      cell: (a) => <span className="text-xs text-muted-foreground">{a.created_by}</span>,
    },
    {
      key: "at",
      header: "When",
      cell: (a) => <span className="text-xs tabular-nums text-muted-foreground">{fmtDate(a.created_at)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 rounded-md border bg-card p-4">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">Type</span>
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => onTypeChange(e.currentTarget.value as AdjustmentType | "all")}
              className="appearance-none rounded-md border bg-background pl-3 pr-8 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="CREDIT">CREDIT</option>
              <option value="DEBIT">DEBIT</option>
              <option value="EXPIRE">EXPIRE</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />
          </div>
        </label>
      </div>
      {error ? (
        <ErrorState message={error.message ?? "Failed to load adjustments"} onRetry={onRefresh} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Coins className="size-6" aria-hidden />}
          heading="No adjustments yet"
          description="Manual SU credits, debits, and expirations show up here."
        />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption={`${rows.length} adjustments`} />
      )}
    </div>
  );
}
