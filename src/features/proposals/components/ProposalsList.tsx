"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge, type StatusBadgeVariant } from "@/shared/ui/StatusBadge";
import { buttonVariants } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import Link from "next/link";
import * as React from "react";
import { PROPOSAL_STATUSES, type Proposal, type ProposalStatus } from "../types";

function statusVariant(status: ProposalStatus): StatusBadgeVariant {
  if (status === "APPROVED") return "approved";
  if (status === "DENIED" || status === "WITHDRAWN") return "rejected";
  if (status === "UNDER_REVIEW") return "warning";
  if (status === "SUBMITTED") return "pending";
  if (status === "DRAFT") return "inactive";
  return "pending";
}

export type ProposalsListProps = {
  rows: Proposal[];
  isLoading: boolean;
  error: Error | null;
  canCreate: boolean;
  onRetry: () => void;
};

export function ProposalsList({ rows, isLoading, error, canCreate, onRetry }: ProposalsListProps) {
  const [statusFilter, setStatusFilter] = React.useState<ProposalStatus | "ALL">("ALL");
  const [search, setSearch] = React.useState("");
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  const filtered = React.useMemo(() => {
    return rows.filter((p) => {
      if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        if (
          !p.title.toLowerCase().includes(needle) &&
          !p.project_title.toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      if (fromDate && p.created_at < fromDate) return false;
      if (toDate && p.created_at > `${toDate}T23:59:59`) return false;
      return true;
    });
  }, [rows, statusFilter, search, fromDate, toDate]);

  const columns: DataTableColumn<Proposal>[] = [
    {
      key: "title",
      header: "Title",
      cell: (row) => (
        <Link
          href={`/proposals/${row.id}`}
          className="font-medium text-nexus-blue-700 hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: "project",
      header: "Project",
      cell: (row) => <span className="text-sm">{row.project_title}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <StatusBadge variant={statusVariant(row.status)} label={row.status} />,
    },
    {
      key: "resources",
      header: "Resources",
      cell: (row) => {
        const total = row.resources.reduce((acc, r) => acc + r.requested_su_amount, 0);
        return (
          <span className="text-sm text-muted-foreground">
            {row.resources.length} × {total.toLocaleString()} SU
          </span>
        );
      },
    },
    {
      key: "submitted",
      header: "Submitted",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "decision",
      header: "Decision",
      cell: (row) =>
        row.decision ? (
          <span className="text-xs text-muted-foreground">
            {row.decision.decided_by}
            <br />
            {new Date(row.decision.decided_at).toLocaleDateString()}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <section className="space-y-4" aria-label="Proposals list">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold">Proposals</h1>
        {canCreate ? (
          <Link href="/proposals/new" className={buttonVariants()}>
            New proposal
          </Link>
        ) : null}
      </header>

      <div className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="prop-status">Status</Label>
          <select
            id="prop-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.currentTarget.value as ProposalStatus | "ALL")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="ALL">All</option>
            {PROPOSAL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prop-search">Project / title</Label>
          <Input
            id="prop-search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prop-from">From</Label>
          <Input
            id="prop-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.currentTarget.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prop-to">To</Label>
          <Input
            id="prop-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.currentTarget.value)}
          />
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message ?? "Failed to load proposals"} onRetry={onRetry} />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No proposals"
          description={
            canCreate
              ? "Start a new proposal to request a new allocation."
              : "Once a PI submits a proposal you'll see it here."
          }
        />
      ) : (
        <DataTable columns={columns} rows={filtered} rowKey={(row) => row.id} caption="Proposals" />
      )}
    </section>
  );
}
