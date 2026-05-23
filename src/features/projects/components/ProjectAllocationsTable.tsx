"use client";

import { formatSU } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import {
  StatusBadge,
  statusBadgeVariantFromAllocationStatus,
} from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import Link from "next/link";
import type { ComputeAllocation } from "../schemas";

export type ProjectAllocationRow = {
  allocation: ComputeAllocation;
  usedSu: number;
  // Free-text label for the Resources column (joined name list). Cheap join
  // upstream so the cell doesn't need to know about the per-resource shape.
  resourceSummary: string;
};

export type ProjectAllocationsTableProps = {
  rows: ProjectAllocationRow[];
};

export function ProjectAllocationsTable({ rows }: ProjectAllocationsTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState
        heading="No allocations yet"
        description="Submit a proposal or add an allocation to get started."
      />
    );
  }

  const columns: Array<DataTableColumn<ProjectAllocationRow>> = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <Link
          href={`/allocations/${row.allocation.id}`}
          className="font-medium text-foreground hover:underline"
        >
          {row.allocation.name}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Type",
      // Type column is placeholder per spec §6.2 — every row is "Compute" today
      // because there is no DataAllocation entity yet (point #5 in spec is deferred).
      cell: () => <span className="text-sm text-muted-foreground">Compute</span>,
    },
    {
      key: "resources",
      header: "Resources",
      cell: (row) => (
        <span className="text-sm text-muted-foreground" title={row.resourceSummary}>
          {row.resourceSummary || "—"}
        </span>
      ),
    },
    {
      key: "usage",
      header: "Used / Allocated",
      cell: (row) => {
        const max = row.allocation.initial_su_amount;
        return (
          <div className="flex w-44 flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {formatSU(row.usedSu)} / {formatSU(max)}
            </span>
            <UsageBar value={row.usedSu} max={max} size="sm" />
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          variant={statusBadgeVariantFromAllocationStatus(row.allocation.status)}
          label={row.allocation.status}
        />
      ),
    },
  ];

  return <DataTable columns={columns} rows={rows} rowKey={(row) => row.allocation.id} />;
}
