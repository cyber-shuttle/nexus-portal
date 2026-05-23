"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { EnableToggle, type EnableToggleImpact } from "@/shared/ui/EnableToggle";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { TableSkeleton } from "@/shared/ui/Loading";
import { Server } from "lucide-react";
import * as React from "react";
import type { Cluster, ClusterStatus } from "../schemas";

export type ClustersTableProps = {
  rows: Cluster[];
  isLoading: boolean;
  error: Error | null;
  statusFilter: "" | ClusterStatus;
  typeFilter: string;
  q: string;
  onStatusChange: (next: "" | ClusterStatus) => void;
  onTypeChange: (next: string) => void;
  onQueryChange: (next: string) => void;
  // Returning a Promise lets the EnableToggle dialog spinner mirror the
  // mutation lifecycle and surface failures inline without flipping the row.
  onToggle: (cluster: Cluster, next: boolean) => Promise<void>;
  canManage: boolean;
  onRetry: () => void;
};

const STATUS_OPTIONS: Array<{ value: "" | ClusterStatus; label: string }> = [
  { value: "", label: "All" },
  { value: "ENABLED", label: "Enabled" },
  { value: "DISABLED", label: "Disabled" },
];

function impactFor(row: Cluster): EnableToggleImpact {
  return {
    activeAllocations: row.allocation_count,
    activeUsers: row.user_count,
    ...(typeof row.inflight_jobs === "number" ? { inflightJobs: row.inflight_jobs } : {}),
  };
}

// Presentational shell for /admin/resources -> Clusters tab. All state +
// data-fetching live in the container; this component just renders rows + the
// filter strip and forwards the toggle event. Disabled rows render with a
// muted treatment per spec §6.5 — never red, since disabled is an operational
// state and not an error.
export function ClustersTable({
  rows,
  isLoading,
  error,
  statusFilter,
  typeFilter,
  q,
  onStatusChange,
  onTypeChange,
  onQueryChange,
  onToggle,
  canManage,
  onRetry,
}: ClustersTableProps) {
  const [draft, setDraft] = React.useState(q);
  React.useEffect(() => setDraft(q), [q]);

  // The Type dropdown is rendered from the union of types we actually have on
  // hand; the seed only carries "Compute" today, but the picker will widen
  // automatically when the backend ships richer types.
  const types = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.type) set.add(r.type);
    }
    return Array.from(set).sort();
  }, [rows]);

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (typeFilter && r.type !== typeFilter) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        (r.location ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, statusFilter, typeFilter, q]);

  // DataTable applies cell styles uniformly, so we mute the row content per-
  // cell when status is DISABLED. We only dim with `opacity-70` (not also
  // `text-muted-foreground`) because the cell text on this table already
  // uses the muted token in places, and stacking both pushes contrast below
  // WCAG AA. The EnableToggle pill in the Status column stays at full
  // contrast because it owns the row's primary affordance.
  const muteIfDisabled = (r: Cluster, className: string) =>
    r.status === "DISABLED" ? `${className} opacity-70` : className;

  const columns: DataTableColumn<Cluster>[] = [
    {
      key: "name",
      header: "Cluster",
      cell: (r) => (
        <span className={muteIfDisabled(r, "font-medium")} data-testid={`cluster-row-${r.id}`}>
          {r.name}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      // Keep at full body text token (not muted-foreground) so 14px AA
      // contrast holds even when the row is otherwise muted via opacity-70.
      cell: (r) => <span className={muteIfDisabled(r, "text-sm")}>{r.type ?? "—"}</span>,
    },
    {
      key: "location",
      header: "Location",
      cell: (r) => <span className={muteIfDisabled(r, "text-sm")}>{r.location ?? "—"}</span>,
    },
    {
      key: "allocs",
      header: "# Allocations",
      align: "right",
      cell: (r) => (
        <span className={muteIfDisabled(r, "tabular-nums")}>
          {r.allocation_count.toLocaleString()}
        </span>
      ),
    },
    {
      key: "users",
      header: "# Users",
      align: "right",
      cell: (r) => (
        <span className={muteIfDisabled(r, "tabular-nums")}>{r.user_count.toLocaleString()}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      // Interactive so DataTable skips its row-click button wrapper — the
      // EnableToggle owns its own click + confirmation flow.
      interactive: true,
      cell: (r) => (
        <EnableToggle
          enabled={r.status === "ENABLED"}
          resource={{ kind: "cluster", id: r.id, label: r.name }}
          impact={impactFor(r)}
          onConfirm={(next) => onToggle(r, next)}
          disabled={!canManage}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-3 rounded-md border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          onQueryChange(draft);
        }}
      >
        <div className="flex flex-col gap-1">
          <Label htmlFor="cluster-q">Search</Label>
          <Input
            id="cluster-q"
            type="search"
            placeholder="Cluster name or location"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            className="w-56"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cluster-status">Status</Label>
          <select
            id="cluster-status"
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => onStatusChange(e.currentTarget.value as "" | ClusterStatus)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="cluster-type">Type</Label>
          <select
            id="cluster-type"
            className="rounded-md border bg-background px-3 py-1.5 text-sm"
            value={typeFilter}
            onChange={(e) => onTypeChange(e.currentTarget.value)}
          >
            <option value="">All types</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </form>

      {error ? (
        <ErrorState message={error.message ?? "Failed to load clusters"} onRetry={onRetry} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Server className="size-6" aria-hidden />}
          heading="No clusters match these filters"
          description="Try widening the filter or clearing the search."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(r) => r.id}
          caption={`${filtered.length} cluster${filtered.length === 1 ? "" : "s"}`}
        />
      )}
    </div>
  );
}
