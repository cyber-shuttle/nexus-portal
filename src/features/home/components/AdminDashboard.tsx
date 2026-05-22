import Link from "next/link";
import type { AdminHomeSummary } from "../types";
import { StatCard } from "@/shared/ui/StatCard";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { ErrorState } from "@/shared/ui/ErrorState";
import { EmptyState } from "@/shared/ui/EmptyState";
import { StackedAreaUsage } from "@/shared/charts/StackedAreaUsage";
import { internalLinks } from "@/lib/links";
import { formatSU } from "@/lib/format";
import { PersonaPill } from "./PersonaPill";
import { RecentActivityFeed } from "./RecentActivityFeed";

export type AdminDashboardProps = {
  firstName: string;
  summary: AdminHomeSummary | undefined;
  isLoading: boolean;
  error: Error | null;
};

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
          <h1 className="font-heading text-3xl font-semibold text-foreground">
            Welcome, {firstName}
          </h1>
          <PersonaPill label="Admin" tone="admin" />
        </div>
        <Link
          href={internalLinks.adminAllProjects}
          className="text-sm text-[color:var(--nexus-blue-700)] hover:underline"
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
        <StatCard
          title="SUs charged (qtr)"
          value={formatSU(summary.total_su_charged_quarter)}
        />
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
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="font-heading text-base font-semibold">Pending change requests</h2>
            <Link
              href={internalLinks.changeRequests}
              className="text-xs text-[color:var(--nexus-blue-700)] hover:underline"
            >
              View queue
            </Link>
          </header>
          {summary.pending_change_requests.length === 0 ? (
            <div className="p-5">
              <EmptyState heading="Queue empty" description="No pending change requests." />
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Allocation</th>
                  <th className="px-5 py-2 font-medium">Requester</th>
                  <th className="px-5 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.pending_change_requests.slice(0, 8).map((cr) => (
                  <tr key={cr.id}>
                    <td className="px-5 py-3 font-medium">
                      <Link
                        href={`/allocations/${cr.compute_allocation_id}`}
                        className="hover:underline"
                      >
                        {cr.compute_allocation_id}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{cr.requester_id}</td>
                    <td className="px-5 py-3">
                      <StatusBadge variant="pending" label={cr.change_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <div className="space-y-4">
          <StatCard
            title="AMIE packets needing attention"
            value={summary.amie_failed_24h}
            sublabel="Failed in last 24h"
            className={
              summary.amie_failed_24h > 0
                ? "ring-1 ring-[color:var(--nexus-red-200)] bg-[color:var(--nexus-red-50)]"
                : undefined
            }
          />
          <RecentActivityFeed events={summary.recent_activity} heading="Site-wide activity" />
        </div>
      </section>
    </div>
  );
}
