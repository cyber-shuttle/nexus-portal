"use client";

import { formatNumber } from "@/lib/format";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CardSkeleton } from "@/shared/ui/Loading";
import { StatCard } from "@/shared/ui/StatCard";
import { StatCardRow } from "@/shared/ui/StatCardRow";
import { TabsRouter } from "@/shared/ui/TabsRouter";
import { subject } from "@casl/ability";
import { getAllocationResources } from "@features/allocations/api";
import { allocationKeys } from "@features/allocations/queries";
import {
  getChangeRequestsForAllocation,
} from "@features/change-requests/api";
import { changeRequestKeys } from "@features/change-requests/queries";
import { getMembershipsForAllocation } from "@features/members/api";
import { memberKeys, useUser } from "@features/members/queries";
import { ProjectDetailHeader } from "@features/projects/components/ProjectDetailHeader";
import {
  type ProjectAllocationRow,
  ProjectAllocationsTable,
} from "@features/projects/components/ProjectAllocationsTable";
import {
  useProject,
  useProjectComputeAllocations,
} from "@features/projects/queries";
import { getAllocationUsageTotal } from "@features/usage/api";
import { usageKeys } from "@features/usage/queries";
import { useAbility } from "@shared/casl/AbilityProvider";
import { useQueries } from "@tanstack/react-query";
import { CreditCard, GitPullRequest, Server, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { ProjectAuditTabContainer } from "./ProjectAuditTabContainer";
import { ProjectMembersTab } from "./ProjectMembersTab";
import { ProjectResourceUsageTab } from "./ProjectResourceUsageTab";

export function ProjectDetailContainer({ projectId }: { projectId: string }) {
  const router = useRouter();
  const ability = useAbility();

  const projectQuery = useProject(projectId);
  const allocationsQuery = useProjectComputeAllocations(projectId);
  const piUserQuery = useUser(projectQuery.data?.project_pi_id);

  const allocations = React.useMemo(
    () => allocationsQuery.data ?? [],
    [allocationsQuery.data],
  );

  // Per-allocation usage totals for the KPI strip + table.
  const usageQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: usageKeys.total(a.id),
      queryFn: () => getAllocationUsageTotal(a.id),
      enabled: Boolean(a.id),
    })),
  });

  // Per-allocation resource lists for the Allocations tab table.
  const resourceQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: allocationKeys.resources(a.id),
      queryFn: () => getAllocationResources(a.id),
      enabled: Boolean(a.id),
    })),
  });

  // Project-scoped change-request rollup — composes the per-allocation hook
  // across every allocation in the project. Powers the "Pending CRs" KPI.
  const crQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: changeRequestKeys.forAllocation(a.id),
      queryFn: () => getChangeRequestsForAllocation(a.id),
      enabled: Boolean(a.id),
    })),
  });

  // Membership fan-out for the Members KPI. Same query key the Members tab
  // uses, so the cache is shared and the tab incurs no extra round-trips when
  // opened.
  const membershipQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: memberKeys.forAllocation(a.id),
      queryFn: () => getMembershipsForAllocation(a.id),
      enabled: Boolean(a.id),
    })),
  });

  const totalAllocatedSu = allocations.reduce((s, a) => s + (a.initial_su_amount ?? 0), 0);
  const totalUsedSu = usageQueries.reduce(
    (s, q) => s + ((q.data as { total_su_amount?: number } | undefined)?.total_su_amount ?? 0),
    0,
  );

  const pendingCRCount = crQueries.reduce((sum, q) => {
    const rows = (q.data ?? []) as Array<{ change_status: string }>;
    return sum + rows.filter((r) => r.change_status === "PENDING").length;
  }, 0);

  // CASL gate — early ErrorState when read denied. We guard after the
  // project query lands so the rule can match against the row's id.
  if (projectQuery.isLoading) return <CardSkeleton />;
  if (projectQuery.error) {
    return (
      <ErrorState
        message={(projectQuery.error as Error).message}
        onRetry={() => projectQuery.refetch()}
      />
    );
  }
  const project = projectQuery.data;
  if (!project) return null;

  const canRead = ability.can("read", subject("Project", { id: project.id }));
  if (!canRead) {
    return (
      <ErrorState
        heading="Access denied"
        message="You do not have permission to view this project."
      />
    );
  }

  // PI display name fallback chain matches AllocationDetailHeader's logic.
  const piName =
    piUserQuery.data?.first_name || piUserQuery.data?.last_name
      ? [piUserQuery.data?.first_name, piUserQuery.data?.last_name].filter(Boolean).join(" ")
      : (piUserQuery.data?.email ?? null);

  // Distinct members across every allocation. The fan-out shares a cache key
  // with the Members tab so opening the tab is free after this loads. We
  // intentionally render "—" until every membership query has resolved so the
  // KPI never flickers a partial undercount.
  const membershipsLoading =
    membershipQueries.length === 0 ? false : membershipQueries.some((q) => q.isLoading);
  const distinctMembers = React.useMemo(() => {
    const set = new Set<string>();
    for (const q of membershipQueries) {
      const rows = (q.data ?? []) as Array<{ user_id: string }>;
      for (const m of rows) set.add(m.user_id);
    }
    return set.size;
  }, [membershipQueries]);
  const membersValue = membershipsLoading ? "—" : String(distinctMembers);

  const canAddAllocation = ability.can(
    "create",
    subject("Allocation", { projectId: project.id }),
  );

  const allocationRows: ProjectAllocationRow[] = allocations.map((a, i) => {
    const usage = usageQueries[i]?.data as { total_su_amount?: number } | undefined;
    const resources = (resourceQueries[i]?.data ?? []) as Array<{ name: string }>;
    return {
      allocation: a,
      usedSu: usage?.total_su_amount ?? 0,
      resourceSummary: resources.map((r) => r.name).join(", "),
    };
  });

  return (
    <section className="space-y-6">
      <ProjectDetailHeader
        project={project}
        piName={piName}
        organizationName={null}
        canAddAllocation={canAddAllocation}
      />

      <StatCardRow cols={4}>
        <StatCard
          icon={CreditCard}
          title="Total Allocated"
          value={formatNumber(totalAllocatedSu)}
          sub="Across all allocations"
        />
        <StatCard
          icon={Server}
          title="Used (all)"
          value={formatNumber(totalUsedSu)}
          sub="Last accounting cycle"
        />
        <StatCard icon={Users} title="Members" value={membersValue} sub="See Members tab" />
        <StatCard
          icon={GitPullRequest}
          title="Pending CRs"
          value={
            pendingCRCount > 0 ? (
              <Link
                href={`/change-requests?project=${project.id}`}
                className="text-brand hover:underline"
              >
                {pendingCRCount}
              </Link>
            ) : (
              <span className="text-muted-foreground">0</span>
            )
          }
          sub={pendingCRCount > 0 ? "Click to review" : "Nothing pending"}
        />
      </StatCardRow>

      <TabsRouter
        defaultValue="allocations"
        tabs={[
          {
            value: "allocations",
            label: "Allocations",
            content: <ProjectAllocationsTable rows={allocationRows} />,
          },
          {
            value: "members",
            label: "Members",
            content: (
              <ProjectMembersTab
                allocations={allocations}
                piUserId={project.project_pi_id}
              />
            ),
          },
          {
            value: "resources",
            label: "Resource Usage",
            content: <ProjectResourceUsageTab projectId={project.id} />,
          },
          {
            value: "audit",
            label: "Audit",
            content: <ProjectAuditTabContainer allocations={allocations} />,
          },
        ]}
      />

      {/* No-op router reference to keep next-link/router hooks loaded during
          server prerender — the Add allocation CTA in the header reroutes when
          enabled in a future phase. */}
      <span aria-hidden className="hidden" data-router={router ? "1" : "0"} />
    </section>
  );
}
