import { Breadcrumbs } from "@/shared/ui/Breadcrumbs";
import { ToolsLanding } from "@features/tools/components/ToolsLanding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tools · Nexus Portal",
};

export default function ToolsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Tools" }]} />
      <header>
        <h1 className="font-heading text-2xl font-semibold">Tools</h1>
        <p className="text-sm text-muted-foreground">
          Operate your allocations: move credits, watch jobs, audit usage.
        </p>
      </header>
      <ToolsLanding />
    </div>
  );
}
