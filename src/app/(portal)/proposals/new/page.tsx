import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { Metadata } from "next";
import { NewProposalContainer } from "./NewProposalContainer";

export const metadata: Metadata = {
  title: "New proposal · Nexus Portal",
};

export default function NewProposalPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Proposals", href: "/proposals" }, { label: "New" }]} />
      <header>
        <h1 className="font-display text-[28px] font-bold leading-tight">New proposal</h1>
        <p className="text-sm text-muted-foreground">
          Step through the wizard to submit an allocation proposal.
        </p>
      </header>
      <NewProposalContainer />
    </div>
  );
}
