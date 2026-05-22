"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import { StackedAreaUsage } from "@/shared/charts/StackedAreaUsage";
import * as React from "react";
import type { AdminResourceRow, AdminResourceUsagePoint } from "../schemas";

export type ResourceDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  row: AdminResourceRow | undefined;
  trend: AdminResourceUsagePoint[];
  trendLoading: boolean;
  error: Error | null;
  onRefresh: () => void;
};

export function ResourceDetailDrawer({
  open,
  onOpenChange,
  row,
  trend,
  trendLoading,
  error,
  onRefresh,
}: ResourceDetailDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={row ? row.name : "Resource"}
      description={row ? `${row.resource_type} · ${row.cluster_name}` : undefined}
      width="lg"
    >
      {!row ? (
        <p className="text-sm text-muted-foreground">No resource selected.</p>
      ) : error ? (
        <ErrorState message={error.message ?? "Failed to load resource"} onRetry={onRefresh} />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge
              variant={row.status === "ACTIVE" ? "active" : "inactive"}
              label={row.status}
            />
            <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Allocations</dt>
            <dd className="tabular-nums">{row.allocation_count}</dd>
            <dt className="text-muted-foreground">Total allocated</dt>
            <dd className="tabular-nums">{row.total_allocated_su.toLocaleString()} SU</dd>
            <dt className="text-muted-foreground">Total used</dt>
            <dd className="tabular-nums">{row.total_used_su.toLocaleString()} SU</dd>
            <dt className="text-muted-foreground">Effective rates</dt>
            <dd className="tabular-nums">{row.rate_count}</dd>
          </dl>
          <div>
            <p className="mb-2 text-sm font-medium">Utilization</p>
            <UsageBar
              value={row.total_used_su}
              max={Math.max(1, row.total_allocated_su)}
              label={`${row.used_pct.toFixed(1)}%`}
              ariaLabel={`${row.name} utilization`}
            />
          </div>
          <section aria-labelledby="trend-heading" className="space-y-2">
            <h3 id="trend-heading" className="text-sm font-semibold">
              Last 30 days
            </h3>
            {trendLoading ? (
              <CenteredSpinner label="Loading trend" />
            ) : trend.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No usage in the last 30 days for this resource.
              </p>
            ) : (
              <StackedAreaUsage
                data={trend.map((p) => ({ date: p.date, used: p.used_su }))}
                seriesKeys={["used"]}
                ariaLabel={`Usage trend for ${row.name}`}
              />
            )}
          </section>
        </div>
      )}
    </SideDrawer>
  );
}
