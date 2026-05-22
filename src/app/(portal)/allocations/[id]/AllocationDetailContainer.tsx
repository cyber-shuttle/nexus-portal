"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { CardSkeleton } from "@/shared/ui/Loading";
import { Button } from "@/shared/ui/button";
import { TabsRouter } from "@/shared/ui/TabsRouter";
import { subject } from "@casl/ability";
import {
  AllocationDetailHeader,
  buildHeaderResources,
} from "@features/allocations/components/AllocationDetailHeader";
import { CreditsAndResources } from "@features/allocations/components/CreditsAndResources";
import { useAllocation, useAllocationResources } from "@features/allocations/queries";
import { RequestExtensionDrawer } from "@features/change-requests/components/RequestExtensionDrawer";
import { AddMemberDrawer } from "@features/members/components/AddMemberDrawer";
import { MembersTab } from "@features/members/components/MembersTab";
import { useAllocationMembers, useUser } from "@features/members/queries";
import { useProject } from "@features/projects/queries";
import { getAllocationUsages } from "@features/usage/api";
import { usageKeys, useAllocationUsageTotal } from "@features/usage/queries";
import { useAbility } from "@shared/casl/AbilityProvider";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import * as React from "react";
import { AuditTabContainer } from "./AuditTabContainer";

// TODO: server aggregation. Fetch up to 1000 usage rows and group client-side
// per resource until the backend exposes /compute-allocation-resources/{id}/usages/total.
const USAGE_PAGE_LIMIT = 1000;

export function AllocationDetailContainer({ allocationId }: { allocationId: string }) {
  const allocationQuery = useAllocation(allocationId);
  const usageQuery = useAllocationUsageTotal(allocationId);
  const projectQuery = useProject(allocationQuery.data?.project_id);
  const piUserId = projectQuery.data?.project_pi_id;
  const piUserQuery = useUser(piUserId);
  const membersQuery = useAllocationMembers(allocationId);

  const usagesQuery = useQuery({
    queryKey: usageKeys.list(allocationId, { limit: USAGE_PAGE_LIMIT }),
    queryFn: () => getAllocationUsages(allocationId, { limit: USAGE_PAGE_LIMIT }),
    enabled: Boolean(allocationId),
  });

  const usedByResource = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const u of usagesQuery.data ?? []) {
      const prev = map.get(u.compute_allocation_resource_id) ?? 0;
      map.set(u.compute_allocation_resource_id, prev + u.used_su_amount);
    }
    return map;
  }, [usagesQuery.data]);

  const used = usageQuery.data?.total_su_amount ?? 0;
  const session = useSession().data;
  const requesterId = session?.user?.id ?? "";
  const ability = useAbility();
  const canManageMembers = ability.can("manage", subject("Membership", { allocationId }));

  const resourcesQuery = useAllocationResources(allocationId);
  const resourceList = React.useMemo(
    () => (resourcesQuery.data ?? []).map((r) => ({ id: r.id, name: r.name })),
    [resourcesQuery.data],
  );

  const [extensionOpen, setExtensionOpen] = React.useState(false);
  const [addMemberOpen, setAddMemberOpen] = React.useState(false);
  const currentSuAmount = allocationQuery.data?.initial_su_amount ?? 0;
  const allocationEndTime = allocationQuery.data?.end_time ?? new Date().toISOString();

  if (allocationQuery.isLoading) return <CardSkeleton />;
  if (allocationQuery.error) {
    return (
      <ErrorState
        message={(allocationQuery.error as Error).message}
        onRetry={() => allocationQuery.refetch()}
      />
    );
  }
  const allocation = allocationQuery.data;
  if (!allocation) return null;

  const remaining = Math.max(0, allocation.initial_su_amount - used);
  // Prefer "First Last"; fall back to email; finally em-dash in the header.
  const piName =
    piUserQuery.data?.first_name || piUserQuery.data?.last_name
      ? [piUserQuery.data?.first_name, piUserQuery.data?.last_name].filter(Boolean).join(" ")
      : (piUserQuery.data?.email ?? null);
  const memberCount = membersQuery.data?.length ?? 0;
  const headerResources = buildHeaderResources(resourcesQuery.data ?? [], usedByResource);
  // The credits card sub-line tracks when the total-usage figure last refreshed.
  const updatedAt = usageQuery.dataUpdatedAt || null;

  const memberIds = (membersQuery.data ?? []).map((row) => row.membership.user_id);

  return (
    <section className="space-y-6">
      <AllocationDetailHeader
        allocation={allocation}
        piName={piName}
        memberCount={memberCount}
        resources={headerResources}
        remainingCredits={remaining}
        updatedAt={updatedAt}
      />
      <TabsRouter
        defaultValue="users"
        tabs={[
          {
            value: "users",
            label: "Users & Roles",
            content: (
              <MembersTab
                allocationId={allocationId}
                piUserId={piUserId}
                canManage={canManageMembers}
                resources={resourceList}
              />
            ),
          },
          {
            value: "credits",
            label: "Credits & Resources",
            content: (
              <CreditsAndResources
                allocationId={allocationId}
                usedByResource={usedByResource}
                onRequestExtension={() => setExtensionOpen(true)}
              />
            ),
          },
          {
            value: "audit",
            label: "Audit log",
            content: <AuditTabContainer allocationId={allocationId} />,
          },
        ]}
        rightSlot={{
          users: canManageMembers ? (
            <Button
              variant="default"
              aria-label="Add user"
              data-testid="add-member"
              onClick={() => setAddMemberOpen(true)}
            >
              Add user
            </Button>
          ) : undefined,
          credits: undefined,
          audit: undefined,
        }}
      />
      <AddMemberDrawer
        open={addMemberOpen}
        onOpenChange={setAddMemberOpen}
        allocationId={allocationId}
        allocationEndTime={allocationEndTime}
        excludeUserIds={memberIds}
      />
      <RequestExtensionDrawer
        open={extensionOpen}
        onOpenChange={setExtensionOpen}
        allocationId={allocationId}
        requesterId={requesterId}
        currentSuAmount={currentSuAmount}
      />
    </section>
  );
}
