import { TabsRouter } from "@/shared/ui/TabsRouter";
import { ClustersContainer } from "./ClustersContainer";
import { ResourcesContainer } from "./ResourcesContainer";

// /admin/resources gains a TabsRouter per spec §6.5 — Clusters is the default
// landing tab and Resources keeps the existing site-wide resource rollup.
export default function AdminResourcesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-bold leading-tight">Resources & Clusters</h1>
        <p className="text-sm text-muted-foreground">
          Manage compute clusters and inspect site-wide resource usage.
        </p>
      </header>

      <TabsRouter
        defaultValue="clusters"
        tabs={[
          { value: "clusters", label: "Clusters", content: <ClustersContainer /> },
          { value: "resources", label: "Resources", content: <ResourcesContainer /> },
        ]}
      />
    </div>
  );
}
