import type { Metadata } from "next";
import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { ClientsContainer } from "./ClientsContainer";

export const metadata: Metadata = {
  title: "Clients · Nexus Portal",
};

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Clients" }]} />
      <ClientsContainer />
    </div>
  );
}
