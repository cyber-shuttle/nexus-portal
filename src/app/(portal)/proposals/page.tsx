import type { Metadata } from "next";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { ProposalsListContainer } from "./ProposalsListContainer";

export const metadata: Metadata = {
  title: "Proposals · Nexus Portal",
};

export default function ProposalsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Proposals" }]} />
      <ProposalsListContainer />
    </div>
  );
}
