import { formatSU } from "@/lib/format";
import { internalLinks } from "@/lib/links";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { StatCard } from "@/shared/ui/StatCard";
import { StatusBadge, statusBadgeVariantFromAllocationStatus } from "@/shared/ui/StatusBadge";
import Link from "next/link";
import type { PiHomeSummary } from "../types";
import { PersonaPill } from "./PersonaPill";
import { RecentActivityFeed } from "./RecentActivityFeed";

export type PiDashboardProps = {
  firstName: string;
  summary: PiHomeSummary | undefined;
  isLoading: boolean;
  error: Error | null;
};

export function PiDashboard({ firstName, summary, isLoading, error }: PiDashboardProps) {
  if (isLoading) return <CenteredSpinner label="Loading PI dashboard" />;
  if (error) return <ErrorState message={error.message} />;
  if (!summary) return null;

  const totalAllocated = summary.projects.reduce((acc, p) => acc + p.total_su, 0);
  const totalUsed30d = summary.usage.last_30d_su;
  const pendingCount = summary.pending_change_requests.length;
  const totalCapacity = summary.projects.reduce((acc, p) => acc + p.total_su, 0);
  const totalUsedAll = summary.projects.reduce((acc, p) => acc + p.used_su, 0);
  const percentRemaining =
    totalCapacity === 0 ? 0 : Math.max(0, Math.round((1 - totalUsedAll / totalCapacity) * 100));

  return (
    <div className="space-y-8" data-testid="pi-dashboard">
      <section className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold text-foreground">
          Welcome, {firstName}
        </h1>
        <PersonaPill label="PI" tone="pi" />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Total allocated SUs" value={formatSU(totalAllocated)} />
        <StatCard title="Used last 30d" value={formatSU(totalUsed30d)} />
        <StatCard title="Remaining" value={`${percentRemaining}%`} sublabel="across projects" />
        <StatCard title="Pending change requests" value={pendingCount} />
      </section>

      <section className="rounded-lg border bg-card">
        <header className="border-b px-5 py-3">
          <h2 className="font-heading text-base font-semibold">My projects</h2>
        </header>
        {summary.projects.length === 0 ? (
          <div className="p-5">
            <EmptyState
              heading="No projects yet"
              description="You are not the PI on any project."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-2 font-medium">Project</th>
                <th className="px-5 py-2 font-medium">Allocations</th>
                <th className="px-5 py-2 font-medium">SUs allocated</th>
                <th className="px-5 py-2 font-medium">Used</th>
                <th className="px-5 py-2 font-medium">Pending CRs</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.projects.map((p) => (
                <tr key={p.project.id}>
                  <td className="px-5 py-3 font-medium">
                    <span>{p.project.originated_id}</span>
                    <div className="text-xs text-muted-foreground">{p.project.title}</div>
                  </td>
                  <td className="px-5 py-3 tabular-nums">{p.allocation_count}</td>
                  <td className="px-5 py-3 tabular-nums">{formatSU(p.total_su)}</td>
                  <td className="px-5 py-3 tabular-nums">{formatSU(p.used_su)}</td>
                  <td className="px-5 py-3 tabular-nums">{p.pending_cr_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <section className="rounded-lg border bg-card">
          <header className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="font-heading text-base font-semibold">Pending change requests</h2>
            <Link
              href={internalLinks.changeRequests}
              className="text-xs text-brand hover:underline"
            >
              View all
            </Link>
          </header>
          {summary.pending_change_requests.length === 0 ? (
            <div className="p-5">
              <EmptyState heading="No pending requests" description="All caught up." />
            </div>
          ) : (
            <ol className="divide-y">
              {summary.pending_change_requests.slice(0, 5).map((cr) => (
                <li key={cr.id} className="px-5 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <Link
                      href={`/allocations/${cr.compute_allocation_id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {cr.compute_allocation_id}
                    </Link>
                    <StatusBadge
                      variant={statusBadgeVariantFromAllocationStatus(cr.requested_status)}
                      label={cr.change_status}
                    />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{cr.reason}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
        <RecentActivityFeed events={summary.recent_activity} />
      </section>
    </div>
  );
}
