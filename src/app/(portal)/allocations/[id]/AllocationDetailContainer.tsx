"use client";

import { TabsRouter } from "@/shared/ui/TabsRouter";
import { subject } from "@casl/ability";
import { AllocationDetailHeader } from "@features/allocations/components/AllocationDetailHeader";
import { CreditsAndResources } from "@features/allocations/components/CreditsAndResources";
import { useAllocation, useAllocationResources } from "@features/allocations/queries";
import { RequestExtensionDrawer } from "@features/change-requests/components/RequestExtensionDrawer";
import { MembersTab } from "@features/members/components/MembersTab";
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
  const piUserId = projectQuery.data?.project_pi_id;
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
  const currentSuAmount = allocationQuery.data?.initial_su_amount ?? 0;
  const allocationEndTime = allocationQuery.data?.end_time ?? new Date().toISOString();

  return (
    <div className="space-y-6">
      <AllocationDetailHeader allocationId={allocationId} used={used} />
      <TabsRouter
        defaultValue="credits"
        tabs={[
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
            value: "users",
            label: "Users & Roles",
            content: (
              <MembersTab
                allocationId={allocationId}
                piUserId={piUserId}
                allocationEndTime={allocationEndTime}
                canManage={canManageMembers}
                resources={resourceList}
              />
            ),
          },
          {
            value: "audit",
            label: "Audit log",
            content: <AuditTabContainer allocationId={allocationId} />,
          },
        ]}
      />
      <RequestExtensionDrawer
        open={extensionOpen}
        onOpenChange={setExtensionOpen}
        allocationId={allocationId}
        requesterId={requesterId}
        currentSuAmount={currentSuAmount}
      />
    </div>
  );
}
