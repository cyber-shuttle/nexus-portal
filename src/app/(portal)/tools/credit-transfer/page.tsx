import type { Metadata } from "next";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { CreditTransferContainer } from "./CreditTransferContainer";

export const metadata: Metadata = {
  title: "Credit transfer · Nexus Portal",
};

export default function CreditTransferPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Tools", href: "/tools" },
          { label: "Credit transfer" },
        ]}
      />
      <header>
        <h1 className="font-heading text-2xl font-semibold">Credit transfer</h1>
        <p className="text-sm text-muted-foreground">
          Atomically move SUs between two of your ACTIVE allocations. Both sides reflect the
          change in the audit log.
        </p>
      </header>
      <CreditTransferContainer />
    </div>
  );
}
