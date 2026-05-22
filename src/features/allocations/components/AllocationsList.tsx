"use client";

import * as React from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import { useAllocationsForUser, allocationKeys } from "../queries";
import { getAllocationResources } from "../api";
import { getMembershipsForAllocation } from "@features/members/api";
import { getAllocationUsageTotal } from "@features/usage/api";
import type { AllocationStatus, ComputeAllocation } from "../schemas";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge, statusBadgeVariantFromAllocationStatus } from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { AllocationStatusFilter } from "./AllocationStatusFilter";

type Row = {
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
  userId: string;
};

export function AllocationsList({ userId }: AllocationsListProps) {
  const allocationsQuery = useAllocationsForUser(userId);
  const allocations = React.useMemo(
    () => allocationsQuery.data ?? [],
    [allocationsQuery.data],
  );

  const auxQueries = useQueries({
    queries: allocations.flatMap((a) => [
      {
        queryKey: [...allocationKeys.detail(a.id), "usages-total"],
        queryFn: () => getAllocationUsageTotal(a.id),
        enabled: true,
      },
      {
        queryKey: [...allocationKeys.detail(a.id), "memberships"],
        queryFn: () => getMembershipsForAllocation(a.id),
        enabled: true,
      },
      {
        queryKey: [...allocationKeys.resources(a.id)],
        queryFn: () => getAllocationResources(a.id),
        enabled: true,
      },
    ]),
  });

  const rows: Row[] = allocations.map((allocation, i) => {
    const baseIndex = i * 3;
    const total = auxQueries[baseIndex]?.data as { total_su_amount?: number } | undefined;
    const memberships = (auxQueries[baseIndex + 1]?.data ?? []) as Array<unknown>;
    const resources = (auxQueries[baseIndex + 2]?.data ?? []) as Array<{
      name: string;
      resource_type: string;
    }>;
    const resourceSummary = resources.length
      ? resources.map((r) => `${r.name} (${r.resource_type})`).join(", ")
      : "—";
    return {
      allocation,
      used: total?.total_su_amount ?? 0,
      members: memberships.length,
      resourceSummary,
    };
  });

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

  const columns: Array<DataTableColumn<Row>> = [
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
        <span className="text-sm text-muted-foreground">
          {formatDate(row.allocation.end_time)}
        </span>
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
        <Button disabled aria-disabled title="Available in Phase 4">
          Add Compute Resources
        </Button>
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

      {allocationsQuery.isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : allocationsQuery.error ? (
        <ErrorState
          message={(allocationsQuery.error as Error).message}
          onRetry={() => allocationsQuery.refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No allocations yet"
          description="Submit a proposal to get started."
        />
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
