import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import type { Metadata } from "next";
import { ChangeRequestsListContainer } from "./ChangeRequestsListContainer";

export const metadata: Metadata = {
  title: "Change requests · Nexus Portal",
};

export default function ChangeRequestsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Change requests" }]} />
      <header>
        <h1 className="font-heading text-2xl font-semibold">Change requests</h1>
        <p className="text-sm text-muted-foreground">
          Review, approve, or deny credit-extension and status-change requests.
        </p>
      </header>
      <ChangeRequestsListContainer />
    </div>
  );
}
