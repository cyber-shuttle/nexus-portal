import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { Metadata } from "next";
import { ProposalDetailContainer } from "./ProposalDetailContainer";

export const metadata: Metadata = {
  title: "Proposal · Nexus Portal",
};

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Proposals", href: "/proposals" }, { label: id }]} />
      <ProposalDetailContainer proposalId={id} />
    </div>
  );
}
