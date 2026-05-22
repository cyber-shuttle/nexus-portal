import { AllocationDetailHeader } from "@features/allocations/components/AllocationDetailHeader";
import { CreditsAndResources } from "@features/allocations/components/CreditsAndResources";
import { MembersTab } from "@features/members/components/MembersTab";
import { AuditTab } from "@features/audit/components/AuditTab";
import { TabsRouter } from "@/shared/ui/TabsRouter";

export default async function AllocationDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return (
    <div className="space-y-6">
      <AllocationDetailHeader allocationId={id} />
      <TabsRouter
        defaultValue="credits"
        tabs={[
          {
            value: "credits",
            label: "Credits & Resources",
            content: <CreditsAndResources allocationId={id} />,
          },
          {
            value: "users",
            label: "Users & Roles",
            content: <MembersTab allocationId={id} />,
          },
          {
            value: "audit",
            label: "Audit log",
            content: <AuditTab allocationId={id} />,
          },
        ]}
      />
    </div>
  );
}
