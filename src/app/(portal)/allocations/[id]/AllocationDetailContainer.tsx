"use client";

import * as React from "react";
import { useAllocation, useProject } from "@features/allocations/queries";
import { useAllocationUsageTotal } from "@features/usage/queries";
import { AllocationDetailHeader } from "@features/allocations/components/AllocationDetailHeader";
import { CreditsAndResources } from "@features/allocations/components/CreditsAndResources";
import { MembersTab } from "@features/members/components/MembersTab";
import { AuditTabContainer } from "./AuditTabContainer";
import { TabsRouter } from "@/shared/ui/TabsRouter";

export function AllocationDetailContainer({ allocationId }: { allocationId: string }) {
  const allocationQuery = useAllocation(allocationId);
  const usageQuery = useAllocationUsageTotal(allocationId);
  const projectQuery = useProject(allocationQuery.data?.project_id);

  const usedByResource = React.useMemo(() => new Map<string, number>(), []);

  const used = usageQuery.data?.total_su_amount ?? 0;
  const piUserId = projectQuery.data?.project_pi_id;

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
              />
            ),
          },
          {
            value: "users",
            label: "Users & Roles",
            content: <MembersTab allocationId={allocationId} piUserId={piUserId} />,
          },
          {
            value: "audit",
            label: "Audit log",
            content: <AuditTabContainer allocationId={allocationId} />,
          },
        ]}
      />
    </div>
  );
}
