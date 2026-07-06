"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge, type StatusBadgeVariant } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { CLIENT_STATUSES, type Client, type ClientStatus } from "../types";

function statusVariant(status: ClientStatus): StatusBadgeVariant {
  return status === "active" ? "active" : "inactive";
}

export type ClientListProps = {
  rows: Client[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  statusFilter: ClientStatus | "all";
  allocationFilter: string;
  ownerFilter: string;
  canCreate: boolean;
  onPageChange: (page: number) => void;
  onStatusChange: (status: ClientStatus | "all") => void;
  onAllocationChange: (allocation: string) => void;
  onOwnerChange: (owner: string) => void;
  onCreate: () => void;
  onRowClick: (client: Client) => void;
  onRetry: () => void;
};

export function ClientList({
  rows,
  total,
  isLoading,
  error,
  page,
  pageSize,
  statusFilter,
  allocationFilter,
  ownerFilter,
  canCreate,
  onPageChange,
  onStatusChange,
  onAllocationChange,
  onOwnerChange,
  onCreate,
  onRowClick,
  onRetry,
}: ClientListProps) {
  const [ownerDraft, setOwnerDraft] = React.useState(ownerFilter);
  const [allocationDraft, setAllocationDraft] = React.useState(allocationFilter);

  React.useEffect(() => {
    setOwnerDraft(ownerFilter);
  }, [ownerFilter]);
  React.useEffect(() => {
    setAllocationDraft(allocationFilter);
  }, [allocationFilter]);

  const columns: DataTableColumn<Client>[] = [
    {
      key: "name",
      header: "Client",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{row.client_id}</span>
        </div>
      ),
    },
    {
      key: "allocation",
      header: "Allocation",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.allocation_name ?? row.allocation_id}
        </span>
      ),
    },
    {
      key: "owner",
      header: "Owner",
      cell: (row) => <span className="text-sm">{row.owner_user_id}</span>,
    },
    {
      key: "secret",
      header: "Secret · last 4",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">…{row.client_secret_last4}</span>
      ),
    },
    {
      key: "issued",
      header: "Issued",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {new Date(row.issued_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge variant={statusVariant(row.status)} label={row.status.toUpperCase()} />
      ),
    },
  ];

  return (
    <section className="space-y-4" aria-label="Clients list">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Workload identities (CI pipelines, agents, automation) that authenticate against
            allocations. Rotate or deactivate secrets when a key is suspected to have leaked.
          </p>
        </div>
        {canCreate ? <Button onClick={onCreate}>New client</Button> : null}
      </header>

      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="client-status">Status</Label>
          <div className="relative">
            <select
              id="client-status"
              value={statusFilter}
              onChange={(e) => onStatusChange(e.currentTarget.value as ClientStatus | "all")}
              className="w-full appearance-none rounded-md border border-input bg-transparent pl-3 pr-8 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="all">All</option>
              {CLIENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 opacity-50" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="client-allocation">Allocation ID</Label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onAllocationChange(allocationDraft.trim());
            }}
          >
            <Input
              id="client-allocation"
              value={allocationDraft}
              placeholder="alloc-…"
              onChange={(e) => setAllocationDraft(e.currentTarget.value)}
            />
            <button
              type="submit"
              className="rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Apply
            </button>
          </form>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="client-owner">Owner</Label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onOwnerChange(ownerDraft.trim());
            }}
          >
            <Input
              id="client-owner"
              value={ownerDraft}
              placeholder="user-id"
              onChange={(e) => setOwnerDraft(e.currentTarget.value)}
            />
            <button
              type="submit"
              className="rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted"
            >
              Apply
            </button>
          </form>
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message ?? "Failed to load clients"} onRetry={onRetry} />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          heading="No clients"
          description={
            canCreate
              ? "Spin up a workload identity to authenticate a CI job or agent."
              : "No clients are registered against your allocations yet."
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          caption="Clients"
          onRowClick={onRowClick}
          pagination={{ page, pageSize, total, onPageChange }}
        />
      )}
    </section>
  );
}
