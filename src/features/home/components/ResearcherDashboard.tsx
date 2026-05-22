import Link from "next/link";
import type { HomeSummary } from "../types";
import type { ComputeAllocation } from "@shared/api/domain";
import { StatCard } from "@/shared/ui/StatCard";
import { Button } from "@/shared/ui/button";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { ErrorState } from "@/shared/ui/ErrorState";
import { externalLinks, internalLinks } from "@/lib/links";
import { formatSU } from "@/lib/format";
import { PersonaPill } from "./PersonaPill";
import { HomeAllocationsList } from "./HomeAllocationsList";
import { RecentActivityFeed } from "./RecentActivityFeed";

export type ResearcherDashboardProps = {
  firstName: string;
  summary: HomeSummary | undefined;
  isLoading: boolean;
  error: Error | null;
  usedByAllocation: Map<string, number>;
};

function totalsByType(
  allocations: ComputeAllocation[],
  usedByAllocation: Map<string, number>,
): { gpu_hours: number; cpu_hours: number; storage_gb: number } {
  // Phase 2 approximation: we don't have a resource-type roll-up endpoint yet,
  // so allocate proportional totals based on allocation usage. Phase 7 polish
  // will source real per-type rollups.
  let total = 0;
  for (const a of allocations) total += usedByAllocation.get(a.id) ?? 0;
  return {
    gpu_hours: Math.round(total * 0.4),
    cpu_hours: Math.round(total * 0.55),
    storage_gb: Math.round(total * 0.05),
  };
}

export function ResearcherDashboard({
  firstName,
  summary,
  isLoading,
  error,
  usedByAllocation,
}: ResearcherDashboardProps) {
  if (isLoading) return <CenteredSpinner label="Loading your dashboard" />;
  if (error) return <ErrorState message={error.message} />;
  if (!summary) return null;

  const hasAllocations = summary.allocations.active.length > 0;
  const totals = totalsByType(summary.allocations.active, usedByAllocation);

  if (!hasAllocations) {
    return (
      <div className="space-y-8" data-testid="researcher-dashboard-empty">
        <section className="rounded-2xl border bg-card p-8 lg:p-10">
          <div className="flex flex-col gap-3">
            <PersonaPill label="Researcher" />
            <h1 className="font-heading text-3xl font-semibold text-foreground">
              Nexus — Getting Started
            </h1>
            <p className="max-w-2xl text-base text-muted-foreground">
              Your gateway to seamless scientific computing. Submit a proposal, wait for
              approval, then start running jobs against your allocation.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Button render={<Link href={internalLinks.proposals}>Submit a proposal</Link>} />
              <Button
                variant="outline"
                render={
                  <a href={externalLinks.watchDemo} target="_blank" rel="noreferrer">
                    Watch demo
                  </a>
                }
              />
              <Button
                variant="ghost"
                render={
                  <a href={externalLinks.docs} target="_blank" rel="noreferrer">
                    Read docs
                  </a>
                }
              />
            </div>
          </div>
        </section>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatCard title="GPU Hours" value="0" sublabel="Last 30 days" />
          <StatCard title="CPU Hours" value="0" sublabel="Last 30 days" />
          <StatCard title="Storage GB" value="0" sublabel="Last 30 days" />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="researcher-dashboard-active">
      <section className="flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold text-foreground">
          Welcome, {firstName}
        </h1>
        <PersonaPill label="Researcher" />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          title="GPU Hours"
          value={formatSU(totals.gpu_hours)}
          sublabel="Last 30 days"
        />
        <StatCard
          title="CPU Hours"
          value={formatSU(totals.cpu_hours)}
          sublabel="Last 30 days"
        />
        <StatCard
          title="Storage GB"
          value={formatSU(totals.storage_gb)}
          sublabel="Last 30 days"
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr,1fr]">
        <HomeAllocationsList
          allocations={summary.allocations.active}
          usedByAllocation={usedByAllocation}
        />
        <RecentActivityFeed events={summary.recent_activity} />
      </section>

      <aside className="rounded-lg border bg-card p-5">
        <h2 className="font-heading text-base font-semibold">Quick links</h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <li>
            <a
              href={externalLinks.watchDemo}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              Watch demo
            </a>
          </li>
          <li>
            <Link
              href={externalLinks.terminal}
              className="block rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              Terminal access
            </Link>
          </li>
          <li>
            <a
              href={externalLinks.docs}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              Docs
            </a>
          </li>
          <li>
            <a
              href={externalLinks.cybershuttle}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border px-3 py-2 text-sm hover:bg-accent"
            >
              CyberShuttle
            </a>
          </li>
        </ul>
      </aside>
    </div>
  );
}
