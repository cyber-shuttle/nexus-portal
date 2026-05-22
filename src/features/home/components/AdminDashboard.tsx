import { formatSU } from "@/lib/format";
import { internalLinks } from "@/lib/links";
import { StackedAreaUsage } from "@/shared/charts/StackedAreaUsage";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { StatCard } from "@/shared/ui/StatCard";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import type { ComputeAllocationChangeRequest } from "@shared/api/domain";
import Link from "next/link";
import type { AdminHomeSummary } from "../types";
import { PersonaPill } from "./PersonaPill";
import { RecentActivityFeed } from "./RecentActivityFeed";

export type AdminDashboardProps = {
  firstName: string;
  summary: AdminHomeSummary | undefined;
  isLoading: boolean;
  error: Error | null;
};

const pendingCrColumns: Array<DataTableColumn<ComputeAllocationChangeRequest>> = [
  {
    key: "allocation",
    header: "Allocation",
    cell: (cr) => (
      <Link
        href={`/allocations/${cr.compute_allocation_id}`}
        className="font-medium text-foreground hover:underline"
      >
        {cr.compute_allocation_id}
      </Link>
    ),
    interactive: true,
  },
  {
    key: "requester",
    header: "Requester",
    cell: (cr) => <span className="text-muted-foreground">{cr.requester_id}</span>,
  },
  {
    key: "status",
    header: "Status",
    cell: (cr) => <StatusBadge variant="pending" label={cr.change_status} />,
  },
];

export function AdminDashboard({ firstName, summary, isLoading, error }: AdminDashboardProps) {
  if (isLoading) return <CenteredSpinner label="Loading admin dashboard" />;
  if (error) return <ErrorState message={error.message} />;
  if (!summary) return null;

  const chartData = summary.allocations_by_day.map((d) => ({
    date: d.date.slice(5),
    new: d.count,
    charged: summary.usage.last_30d_su / Math.max(1, summary.allocations_by_day.length),
  }));

  return (
    <div className="space-y-8" data-testid="admin-dashboard">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">
            Welcome, {firstName}
          </h1>
          <PersonaPill label="Admin" tone="admin" />
        </div>
        <Link
          href={internalLinks.adminAllProjects}
          className="text-sm text-brand hover:underline"
        >
          View all projects
        </Link>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Total projects" value={summary.total_projects} />
        <StatCard title="Active allocations" value={summary.active_allocations} />
        <StatCard
          title="SUs allocated (qtr)"
          value={formatSU(summary.total_su_allocated_quarter)}
        />
        <StatCard title="SUs charged (qtr)" value={formatSU(summary.total_su_charged_quarter)} />
        <StatCard title="Pending proposals" value={summary.pending_proposals} />
      </section>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading text-base font-semibold">Site activity</h2>
            <p className="text-xs text-muted-foreground">
              Allocations created and SUs charged · last 30 days
            </p>
          </div>
        </div>
        <div className="mt-4">
          <StackedAreaUsage
            data={chartData}
            seriesKeys={["new", "charged"]}
            ariaLabel="Site activity last 30 days"
            height={220}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-semibold">Pending change requests</h2>
            <Link
              href={internalLinks.changeRequests}
              className="text-sm text-brand hover:underline"
            >
              View queue
            </Link>
          </div>
          <DataTable
            columns={pendingCrColumns}
            rows={summary.pending_change_requests.slice(0, 8)}
            rowKey={(cr) => cr.id}
            empty={<EmptyState heading="Queue empty" description="No pending change requests." />}
          />
        </section>
        <div className="space-y-4">
          <StatCard
            title="AMIE packets needing attention"
            value={summary.amie_failed_24h}
            sublabel="Failed in last 24h"
            className={
              summary.amie_failed_24h > 0
                ? "border-destructive/40 bg-destructive/5"
                : undefined
            }
          />
          <RecentActivityFeed events={summary.recent_activity} heading="Site-wide activity" />
        </div>
      </section>
    </div>
  );
}
