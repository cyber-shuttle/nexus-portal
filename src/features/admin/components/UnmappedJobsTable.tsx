"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ListChecks } from "lucide-react";
import * as React from "react";
import type { UnmappedJob } from "../schemas";

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function fmtDate(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  return new Date(t).toLocaleString();
}

export type UnmappedJobsTableProps = {
  rows: UnmappedJob[];
  isLoading: boolean;
  error: Error | null;
  allocationOptions: Array<{ id: string; name: string }>;
  onLink: (job: UnmappedJob, allocationId: string) => void;
  onDiscard: (job: UnmappedJob, reason: string) => void;
  onRefresh: () => void;
};

export function UnmappedJobsTable({
  rows,
  isLoading,
  error,
  allocationOptions,
  onLink,
  onDiscard,
  onRefresh,
}: UnmappedJobsTableProps) {
  const [linkPicks, setLinkPicks] = React.useState<Record<string, string>>({});
  const [discardDrafts, setDiscardDrafts] = React.useState<Record<string, string>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const columns: DataTableColumn<UnmappedJob>[] = [
    {
      key: "job",
      header: "Job",
      cell: (j) => (
        <span className="flex flex-col">
          <span className="font-mono text-sm">{j.job_id}</span>
          <span className="text-xs text-muted-foreground">{j.cluster}</span>
        </span>
      ),
    },
    {
      key: "user",
      header: "User",
      cell: (j) => <span className="text-sm">{j.username}</span>,
    },
    {
      key: "wall",
      header: "Walltime",
      align: "right",
      cell: (j) => <span className="text-xs tabular-nums">{fmtDuration(j.walltime_seconds)}</span>,
    },
    {
      key: "su",
      header: "SU charged",
      align: "right",
      cell: (j) => <span className="tabular-nums">{j.su_charged.toLocaleString()}</span>,
    },
    {
      key: "reason",
      header: "Reason",
      cell: (j) => <span className="text-xs text-muted-foreground">{j.reason}</span>,
    },
    {
      key: "seen",
      header: "Observed",
      cell: (j) => <span className="text-xs tabular-nums text-muted-foreground">{fmtDate(j.observed_at)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      interactive: true,
      cell: (j) => {
        const isOpen = expanded[j.id] === true;
        const picked = linkPicks[j.id] ?? "";
        const draftReason = discardDrafts[j.id] ?? "";
        return (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((prev) => ({ ...prev, [j.id]: !isOpen }));
                }}
              >
                {isOpen ? "Close" : "Resolve…"}
              </Button>
            </div>
            {isOpen ? (
              <div className="flex flex-col items-stretch gap-2 rounded-md border bg-muted/30 p-3 text-left">
                <div className="flex items-end gap-2">
                  <select
                    aria-label={`Link ${j.job_id} to allocation`}
                    value={picked}
                    onChange={(e) =>
                      setLinkPicks((prev) => ({ ...prev, [j.id]: e.currentTarget.value }))
                    }
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Pick allocation…</option>
                    {allocationOptions.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!picked}
                    onClick={() => {
                      if (!picked) return;
                      onLink(j, picked);
                      setLinkPicks((prev) => ({ ...prev, [j.id]: "" }));
                      setExpanded((prev) => ({ ...prev, [j.id]: false }));
                    }}
                  >
                    Link
                  </Button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`discard-reason-${j.id}`} className="text-xs">
                      Discard with reason
                    </Label>
                    <Input
                      id={`discard-reason-${j.id}`}
                      type="text"
                      placeholder="reason (≥3 chars)"
                      value={draftReason}
                      onChange={(e) =>
                        setDiscardDrafts((prev) => ({ ...prev, [j.id]: e.currentTarget.value }))
                      }
                      className="w-56"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={draftReason.trim().length < 3}
                    onClick={() => {
                      onDiscard(j, draftReason.trim());
                      setDiscardDrafts((prev) => ({ ...prev, [j.id]: "" }));
                      setExpanded((prev) => ({ ...prev, [j.id]: false }));
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        );
      },
    },
  ];

  if (error) {
    return <ErrorState message={error.message ?? "Failed to load unmapped jobs"} onRetry={onRefresh} />;
  }
  if (isLoading) return <TableSkeleton />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks className="size-6" aria-hidden />}
        heading="Queue empty"
        description="Every accounting record from SLURM has been mapped to a known allocation."
      />
    );
  }
  return <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} caption={`${rows.length} unmapped jobs`} />;
}
