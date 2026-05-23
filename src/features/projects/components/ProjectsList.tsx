"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import {
  StatusBadge,
  statusBadgeVariantFromAllocationStatus,
} from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import Link from "next/link";
import * as React from "react";
import type { Project, ProjectStatus } from "../schemas";

export type ProjectRow = {
  project: Project;
  piLabel: string | null;
  allocationsCount: number;
  totalSu: number;
  usedSu: number;
  usedPct: number;
  // Researcher-only: the row is membership-only (PI is someone else). Rendered
  // as a "PI" or "Member" badge so the persona-aware composition in TF1 doesn't
  // lose context after the dedupe pass.
  membershipBadge?: "pi" | "member" | null;
};

export type ProjectsListEmptyCopy = {
  heading: string;
  description?: string;
  cta?: React.ReactNode;
};

export type ProjectsListProps = {
  rows: ProjectRow[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  // Filter strip state lives in the container (URL-backed) so reloads keep
  // the view; the presentational component takes controlled props.
  search: string;
  onSearchChange: (next: string) => void;
  statusFilter: ProjectStatus | "all";
  onStatusFilterChange: (next: ProjectStatus | "all") => void;
  piFilter: string;
  onPiFilterChange: (next: string) => void;
  // CTA + page-level chrome
  headerCta?: React.ReactNode;
  emptyCopy: ProjectsListEmptyCopy;
};

function formatSU(n: number): string {
  return new Intl.NumberFormat().format(Math.round(n));
}

// Sort: Used % desc, alpha tiebreak on title. Per spec §6.1.
function defaultSort(a: ProjectRow, b: ProjectRow): number {
  if (a.usedPct !== b.usedPct) return b.usedPct - a.usedPct;
  return a.project.title.localeCompare(b.project.title);
}

export function ProjectsList({
  rows,
  isLoading,
  error,
  onRetry,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  piFilter,
  onPiFilterChange,
  headerCta,
  emptyCopy,
}: ProjectsListProps) {
  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const piNeedle = piFilter.trim().toLowerCase();
    return rows
      .filter((row) => {
        if (statusFilter !== "all" && row.project.status !== statusFilter) return false;
        if (needle) {
          const haystack =
            `${row.project.title} ${row.project.originated_id}`.toLowerCase();
          if (!haystack.includes(needle)) return false;
        }
        if (piNeedle) {
          const piHay = (row.piLabel ?? row.project.project_pi_id).toLowerCase();
          if (!piHay.includes(piNeedle)) return false;
        }
        return true;
      })
      .sort(defaultSort);
  }, [rows, search, statusFilter, piFilter]);

  const [page, setPage] = React.useState(1);
  const pageSize = 20;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Reset paging when filters narrow the result set.
  const filterKey = `${search}|${statusFilter}|${piFilter}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: filter changes intentionally reset paging
  React.useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const columns: Array<DataTableColumn<ProjectRow>> = [
    {
      key: "project",
      header: "Project",
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`/projects/${row.project.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {row.project.title}
          </Link>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{row.project.originated_id}</span>
            {row.membershipBadge === "pi" ? (
              <span className="inline-flex rounded-full bg-brand-tint px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                PI
              </span>
            ) : null}
            {row.membershipBadge === "member" ? (
              <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Member
              </span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: "pi",
      header: "PI",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.piLabel ?? row.project.project_pi_id}
        </span>
      ),
    },
    {
      key: "allocations",
      header: "# Allocations",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.allocationsCount}</span>,
    },
    {
      key: "total",
      header: "Total SUs",
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatSU(row.totalSu)}</span>,
    },
    {
      key: "used",
      header: "Used %",
      cell: (row) => (
        <div className="flex w-40 flex-col gap-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.usedPct.toFixed(0)}%
          </span>
          <UsageBar
            value={row.usedSu}
            max={Math.max(row.totalSu, 1)}
            size="sm"
            ariaLabel={`${row.project.title} used`}
          />
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          variant={statusBadgeVariantFromAllocationStatus(row.project.status)}
          label={row.project.status}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Projects you own, manage, or belong to.
          </p>
        </div>
        {headerCta ? <div>{headerCta}</div> : null}
      </div>

      <div className="flex flex-col gap-3 rounded-md border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            type="search"
            placeholder="Search by title or ID"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Search projects"
            className="sm:w-64"
          />
          <Input
            type="search"
            placeholder="PI: any"
            value={piFilter}
            onChange={(e) => onPiFilterChange(e.target.value)}
            aria-label="Filter by PI"
            className="sm:w-56"
          />
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as ProjectStatus | "all")}
            aria-label="Filter by status"
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="all">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DELETED">Deleted</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          heading={emptyCopy.heading}
          description={emptyCopy.description}
          cta={emptyCopy.cta}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={paged}
          rowKey={(row) => row.project.id}
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

// Surface a "+ New project" button used by the page header. Keeps the
// presentational component framework-agnostic; gating happens at the call
// site via CASL `Can` or `ability.can`.
export function NewProjectCta({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      variant="default"
      // Disabled hint: the create modal lands in a future phase. Click is a
      // no-op today; presence of the CTA still signals capability to PIs.
      aria-disabled
      aria-label="New project (available in a future phase)"
      className="opacity-50 cursor-not-allowed"
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
      }}
    >
      + New project
    </Button>
  );
}
