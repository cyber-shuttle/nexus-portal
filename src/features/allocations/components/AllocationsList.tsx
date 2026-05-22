"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge, statusBadgeVariantFromAllocationStatus } from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import Link from "next/link";
import * as React from "react";
import type { AllocationStatus, ComputeAllocation } from "../schemas";
import { AllocationStatusFilter } from "./AllocationStatusFilter";

export type AllocationRow = {
  allocation: ComputeAllocation;
  used: number;
  members: number;
  resourceSummary: string;
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatSU(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export type AllocationsListProps = {
  rows: AllocationRow[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
};

export function AllocationsList({ rows, isLoading, error, onRetry }: AllocationsListProps) {
  const [statusFilter, setStatusFilter] = React.useState<AllocationStatus[]>(["ACTIVE"]);
  const [projectQuery, setProjectQuery] = React.useState("");

  const filtered = rows.filter((row) => {
    if (statusFilter.length > 0 && !statusFilter.includes(row.allocation.status)) return false;
    if (
      projectQuery &&
      !row.allocation.project_id.toLowerCase().includes(projectQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const [page, setPage] = React.useState(1);
  const pageSize = 20;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const filterKey = `${statusFilter.join(",")}|${projectQuery}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: filter changes intentionally reset paging
  React.useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const columns: Array<DataTableColumn<AllocationRow>> = [
    {
      key: "name",
      header: "Allocation",
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
      key: "project",
      header: "Project",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{row.allocation.project_id}</span>
      ),
    },
    {
      key: "resources",
      header: "Resources",
      cell: (row) => (
        <span className="text-sm text-muted-foreground" title={row.resourceSummary}>
          {row.resourceSummary}
        </span>
      ),
    },
    {
      key: "usage",
      header: "Used / Allocated SUs",
      cell: (row) => {
        const max = row.allocation.initial_su_amount;
        return (
          <div className="flex w-44 flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              {formatSU(row.used)} / {formatSU(max)}
            </span>
            <UsageBar value={row.used} max={max} size="sm" />
          </div>
        );
      },
    },
    {
      key: "members",
      header: "Members",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.members}</span>,
    },
    {
      key: "endDate",
      header: "End date",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">{formatDate(row.allocation.end_time)}</span>
      ),
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Allocations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Compute resources granted to you across projects.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-disabled
                aria-label="Add Compute Resources (available in Phase 4)"
                className="opacity-50 cursor-not-allowed"
                onClick={(e) => e.preventDefault()}
              >
                Add Compute Resources
              </Button>
            }
          />
          <TooltipContent>Available in Phase 4</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <AllocationStatusFilter value={statusFilter} onChange={setStatusFilter} />
        <Input
          type="search"
          placeholder="Filter by project id"
          value={projectQuery}
          onChange={(e) => setProjectQuery(e.target.value)}
          aria-label="Filter by project id"
          className="sm:w-72"
        />
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <EmptyState heading="No allocations yet" description="Submit a proposal to get started." />
      ) : (
        <DataTable
          columns={columns}
          rows={paged}
          rowKey={(row) => row.allocation.id}
          pagination={{
            page,
            pageSize,
            total: filtered.length,
            onPageChange: setPage,
          }}
        />
      )}
    </div>
  );
}
