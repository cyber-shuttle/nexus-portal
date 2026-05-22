"use client";

import * as React from "react";
import Link from "next/link";
import type { ComputeAllocationChangeRequest } from "@shared/api/domain";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { StatusBadge, statusBadgeVariantFromChangeRequest } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { TableSkeleton } from "@/shared/ui/Loading";
import { ErrorState } from "@/shared/ui/ErrorState";
import { EmptyState } from "@/shared/ui/EmptyState";
import { formatDate, formatSU } from "@/lib/format";

export type ChangeRequestRowAction =
  | { kind: "approve" }
  | { kind: "deny" }
  | { kind: "view" };

export type ChangeRequestsListProps = {
  rows: ComputeAllocationChangeRequest[];
  isLoading: boolean;
  error: Error | null;
  canActOn: (row: ComputeAllocationChangeRequest) => boolean;
  onAction: (row: ComputeAllocationChangeRequest, action: ChangeRequestRowAction) => void;
  onRetry: () => void;
  pendingMutationIds: Set<string>;
  bulkActionsEnabled: boolean;
  onBulkApprove?: (ids: string[]) => void;
  onBulkDeny?: (ids: string[]) => void;
};

type Filters = {
  status: Record<"PENDING" | "APPROVED" | "REJECTED", boolean>;
  changeType: Record<"INCREASE_CREDITS" | "EXTEND_END_DATE" | "OTHER", boolean>;
  from: string;
  to: string;
  search: string;
};

function deriveChangeType(reason: string): "INCREASE_CREDITS" | "EXTEND_END_DATE" | "OTHER" {
  if (reason.startsWith("[EXTEND_END_DATE")) return "EXTEND_END_DATE";
  if (reason.startsWith("[OTHER]")) return "OTHER";
  return "INCREASE_CREDITS";
}

function defaultFilters(): Filters {
  return {
    status: { PENDING: true, APPROVED: true, REJECTED: true },
    changeType: { INCREASE_CREDITS: true, EXTEND_END_DATE: true, OTHER: true },
    from: "",
    to: "",
    search: "",
  };
}

export function ChangeRequestsList({
  rows,
  isLoading,
  error,
  canActOn,
  onAction,
  onRetry,
  pendingMutationIds,
  bulkActionsEnabled,
  onBulkApprove,
  onBulkDeny,
}: ChangeRequestsListProps) {
  const [filters, setFilters] = React.useState<Filters>(defaultFilters);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const filtered = React.useMemo(() => {
    const fromTs = filters.from ? Date.parse(filters.from) : Number.NEGATIVE_INFINITY;
    const toTs = filters.to ? Date.parse(filters.to) + 86_400_000 : Number.POSITIVE_INFINITY;
    const q = filters.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!filters.status[r.change_status]) return false;
      const type = deriveChangeType(r.reason);
      if (!filters.changeType[type]) return false;
      const ts = Date.parse(r.timestamp);
      if (ts < fromTs || ts > toTs) return false;
      if (q && !r.requester_id.toLowerCase().includes(q) && !r.reason.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [rows, filters]);

  const allActionable = React.useMemo(
    () => filtered.filter((r) => r.change_status === "PENDING" && canActOn(r)),
    [filtered, canActOn],
  );

  const allSelected = allActionable.length > 0 && allActionable.every((r) => selected.has(r.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allActionable.map((r) => r.id)));
  }

  function toggleRow(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  const columns: Array<DataTableColumn<ComputeAllocationChangeRequest>> = [
    ...(bulkActionsEnabled
      ? [
          {
            key: "select",
            header: (
              <input
                type="checkbox"
                aria-label="Select all actionable"
                checked={allSelected}
                onChange={toggleAll}
              />
            ) as React.ReactNode,
            width: "32px",
            cell: (row: ComputeAllocationChangeRequest) =>
              row.change_status === "PENDING" && canActOn(row) ? (
                <input
                  type="checkbox"
                  aria-label={`Select ${row.id}`}
                  checked={selected.has(row.id)}
                  onChange={() => toggleRow(row.id)}
                />
              ) : null,
          } satisfies DataTableColumn<ComputeAllocationChangeRequest>,
        ]
      : []),
    {
      key: "submitted",
      header: "Submitted",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatDate(row.timestamp)}</span>
      ),
    },
    {
      key: "allocation",
      header: "Allocation",
      cell: (row) => (
        <Link
          href={`/allocations/${row.compute_allocation_id}`}
          className="text-sm font-medium text-nexus-blue-700 hover:underline"
        >
          {row.compute_allocation_id}
        </Link>
      ),
    },
    {
      key: "requester",
      header: "Requester",
      cell: (row) => <span className="text-sm">{row.requester_id}</span>,
    },
    {
      key: "type",
      header: "Change type",
      cell: (row) => (
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {deriveChangeType(row.reason).replace(/_/g, " ").toLowerCase()}
        </span>
      ),
    },
    {
      key: "amount",
      header: "Requested SUs",
      align: "right",
      cell: (row) => <span className="text-sm">{formatSU(row.requested_su_amount)}</span>,
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          variant={statusBadgeVariantFromChangeRequest(row.change_status)}
          label={row.change_status}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => {
        const pending = pendingMutationIds.has(row.id);
        if (row.change_status !== "PENDING") {
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction(row, { kind: "view" })}
              aria-label={`View ${row.id}`}
            >
              View
            </Button>
          );
        }
        if (!canActOn(row)) {
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAction(row, { kind: "view" })}
            >
              View
            </Button>
          );
        }
        return (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => onAction(row, { kind: "deny" })}
              aria-label={`Deny ${row.id}`}
            >
              Deny
            </Button>
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onAction(row, { kind: "approve" })}
              aria-label={`Approve ${row.id}`}
            >
              Approve
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <section
        aria-label="Filters"
        className="grid grid-cols-1 gap-3 rounded-md border bg-card p-4 md:grid-cols-4"
      >
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Status
          </legend>
          {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.status[s]}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    status: { ...prev.status, [s]: e.target.checked },
                  }))
                }
              />
              {s}
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Change type
          </legend>
          {(["INCREASE_CREDITS", "EXTEND_END_DATE", "OTHER"] as const).map((t) => (
            <label key={t} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.changeType[t]}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    changeType: { ...prev.changeType, [t]: e.target.checked },
                  }))
                }
              />
              {t.replace(/_/g, " ").toLowerCase()}
            </label>
          ))}
        </fieldset>
        <div className="space-y-1">
          <Label htmlFor="cr-from">From</Label>
          <Input
            id="cr-from"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
          />
          <Label htmlFor="cr-to">To</Label>
          <Input
            id="cr-to"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cr-search">Requester / reason</Label>
          <Input
            id="cr-search"
            type="search"
            placeholder="Search…"
            value={filters.search}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, search: e.target.value }))
            }
          />
        </div>
      </section>

      {bulkActionsEnabled && selected.size > 0 ? (
        <section
          className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
          aria-label="Bulk actions"
        >
          <span className="text-sm">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkDeny?.(Array.from(selected))}
            >
              Bulk deny
            </Button>
            <Button size="sm" onClick={() => onBulkApprove?.(Array.from(selected))}>
              Bulk approve
            </Button>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : filtered.length === 0 ? (
        <EmptyState
          heading="No change requests"
          description="No requests match your current filters."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
        />
      )}
    </div>
  );
}
