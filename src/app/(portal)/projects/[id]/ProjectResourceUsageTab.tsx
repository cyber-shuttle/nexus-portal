"use client";

import { formatSU } from "@/lib/format";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { UsageBar } from "@/shared/ui/UsageBar";
import { MostUsedResourceCallout } from "@features/projects/components/MostUsedResourceCallout";
import { useProjectUsageSummary } from "@features/projects/queries";
import type { ProjectUsageResourceRow } from "@features/projects/schemas";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";

// Project Resource Usage tab — summarized read (callout + sorted table).
// The full explorer lives at /analytics/resources?project=:id; TF3 ships that
// route. The "Explore in Analytics" link is wired now so the affordance is
// discoverable as soon as TF3 lands.

export type ProjectResourceUsageTabProps = {
  projectId: string;
};

function rangeForLastNDays(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

// Tactical fix until the backend exposes a clean resource-class field: the
// seed populates `resource_type` randomly, which lets `cpu-haswell` show up
// as "gpu" and vice versa. Resource names follow a `{class}-{model}`
// convention so the prefix is the reliable signal today.
function deriveResourceType(name: string, fallback: string): string {
  const prefix = name.split("-")[0]?.toLowerCase() ?? "";
  if (prefix === "cpu") return "CPU";
  if (prefix === "gpu") return "GPU";
  if (prefix === "storage" || prefix === "data") return "Storage";
  return fallback;
}

export function ProjectResourceUsageTab({ projectId }: ProjectResourceUsageTabProps) {
  const range = React.useMemo(() => rangeForLastNDays(30), []);
  const { data, isLoading, error, refetch } = useProjectUsageSummary(projectId, range);

  if (isLoading) return <TableSkeleton rows={4} columns={3} />;
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />;
  if (!data) return null;

  const byResource: ProjectUsageResourceRow[] = data.by_resource;

  const calloutRows = byResource.map((r) => ({
    id: r.resource_id,
    name: r.resource_name,
    used_su: r.used_su,
    share_pct: r.used_pct,
  }));

  const tableRows = [...byResource].sort((a, b) => b.used_pct - a.used_pct);

  const columns: Array<DataTableColumn<ProjectUsageResourceRow>> = [
    {
      key: "name",
      header: "Resource",
      cell: (row) => <span className="font-medium text-foreground">{row.resource_name}</span>,
    },
    {
      key: "type",
      header: "Type",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {deriveResourceType(row.resource_name, row.resource_type)}
        </span>
      ),
    },
    {
      key: "used_su",
      header: "Used SUs",
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatSU(row.used_su)}</span>,
    },
    {
      key: "pct",
      header: "Used %",
      cell: (row) => (
        <div className="flex w-40 flex-col gap-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.used_pct.toFixed(0)}%
          </span>
          <UsageBar value={row.used_pct} max={100} size="sm" ariaLabel={row.resource_name} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <MostUsedResourceCallout resources={calloutRows} topN={5} />

      <div className="flex items-center justify-between">
        <h3 className="font-heading text-sm font-semibold text-foreground">
          All resources (last 30 days)
        </h3>
        <Link
          href={`/analytics/resources?project=${projectId}`}
          className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
        >
          Explore in Analytics
          <ArrowUpRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>

      <DataTable columns={columns} rows={tableRows} rowKey={(row) => row.resource_id} />
    </div>
  );
}
