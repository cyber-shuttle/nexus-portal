"use client";

import * as React from "react";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { StatusBadge, type StatusBadgeVariant } from "@/shared/ui/StatusBadge";
import { TableSkeleton } from "@/shared/ui/Loading";
import { ErrorState } from "@/shared/ui/ErrorState";
import { EmptyState } from "@/shared/ui/EmptyState";
import {
  CERTIFICATE_STATUSES,
  type Certificate,
  type CertificateStatus,
  deriveCertificateStatus,
  formatRemainingTime,
  formatUnixClock,
  formatUnixDate,
  getCertificateAllocationLabel,
  getRemainingSeconds,
} from "../types";

function statusVariant(status: CertificateStatus): StatusBadgeVariant {
  if (status === "active") return "active";
  if (status === "revoked") return "rejected";
  return "expired";
}

const TIME_RANGES = [
  { label: "All time", seconds: 0 },
  { label: "Last 24 hours", seconds: 24 * 3600 },
  { label: "Last 7 days", seconds: 7 * 24 * 3600 },
  { label: "Last 30 days", seconds: 30 * 24 * 3600 },
];

export type CertificateListProps = {
  rows: Certificate[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  page: number;
  pageSize: number;
  statusFilter: CertificateStatus | "all";
  usernameFilter: string;
  allocationFilter: string;
  timeRangeLabel: string;
  onPageChange: (page: number) => void;
  onStatusChange: (status: CertificateStatus | "all") => void;
  onUsernameChange: (username: string) => void;
  onAllocationChange: (allocation: string) => void;
  onTimeRangeChange: (label: string) => void;
  onRowClick: (cert: Certificate) => void;
  onRetry: () => void;
};

export function CertificateList({
  rows,
  total,
  isLoading,
  error,
  page,
  pageSize,
  statusFilter,
  usernameFilter,
  allocationFilter,
  timeRangeLabel,
  onPageChange,
  onStatusChange,
  onUsernameChange,
  onAllocationChange,
  onTimeRangeChange,
  onRowClick,
  onRetry,
}: CertificateListProps) {
  const [usernameDraft, setUsernameDraft] = React.useState(usernameFilter);

  React.useEffect(() => {
    setUsernameDraft(usernameFilter);
  }, [usernameFilter]);

  const allocationOptions = React.useMemo(() => {
    return Array.from(new Set(rows.map(getCertificateAllocationLabel))).sort();
  }, [rows]);

  const columns: DataTableColumn<Certificate>[] = [
    {
      key: "serial",
      header: "Serial",
      cell: (row) => (
        <span className="font-mono text-xs text-foreground">{row.serial_number}</span>
      ),
    },
    {
      key: "username",
      header: "Username",
      cell: (row) => <span className="text-sm">{row.username || row.principal}</span>,
    },
    {
      key: "allocation",
      header: "Allocation",
      cell: (row) => (
        <span className="truncate text-sm text-muted-foreground">
          {getCertificateAllocationLabel(row)}
        </span>
      ),
    },
    {
      key: "issued-date",
      header: "Issued",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">{formatUnixDate(row.issued_at)}</span>
      ),
    },
    {
      key: "issued-time",
      header: "Time",
      cell: (row) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatUnixClock(row.issued_at)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => {
        const status = deriveCertificateStatus(row);
        return (
          <div className="flex items-center gap-2">
            <StatusBadge variant={statusVariant(status)} label={status.toUpperCase()} />
            {status === "active" && (
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatRemainingTime(getRemainingSeconds(row))}
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <section className="space-y-4" aria-label="Certificate list">
      <header className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">SSH Certificates</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Track every short-lived SSH certificate the signer has issued. Filter by status,
          allocation, or username; open a row for details or to revoke.
        </p>
      </header>

      <div className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="cert-status">Status</Label>
          <select
            id="cert-status"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.currentTarget.value as CertificateStatus | "all")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All</option>
            {CERTIFICATE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toUpperCase()}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cert-allocation">Allocation</Label>
          <select
            id="cert-allocation"
            value={allocationFilter}
            onChange={(e) => onAllocationChange(e.currentTarget.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="all">All</option>
            {allocationOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cert-range">Time range</Label>
          <select
            id="cert-range"
            value={timeRangeLabel}
            onChange={(e) => onTimeRangeChange(e.currentTarget.value)}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="cert-username">Username</Label>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              onUsernameChange(usernameDraft.trim());
            }}
          >
            <Input
              id="cert-username"
              value={usernameDraft}
              placeholder="Filter by username"
              onChange={(e) => setUsernameDraft(e.currentTarget.value)}
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
        <ErrorState
          message={error.message ?? "Failed to load certificates"}
          onRetry={onRetry}
        />
      ) : isLoading ? (
        <TableSkeleton rows={6} columns={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          heading="No certificates"
          description="No SSH certificates match the current filters."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.serial_number)}
          caption="SSH certificates"
          onRowClick={onRowClick}
          pagination={{
            page,
            pageSize,
            total,
            onPageChange,
          }}
        />
      )}
    </section>
  );
}
