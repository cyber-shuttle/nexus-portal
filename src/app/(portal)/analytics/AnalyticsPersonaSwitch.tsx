"use client";

import type { AnalyticsPersona } from "@/shared/auth/personaForAnalytics";
import { TabsRouter } from "@/shared/ui/TabsRouter";
import { AdminAnalyticsContainer } from "./AdminAnalyticsContainer";
import { PiAnalyticsContainer } from "./PiAnalyticsContainer";
import { ResearcherAnalyticsContainer } from "./ResearcherAnalyticsContainer";
import { ResourcesAnalyticsContainer } from "./ResourcesAnalyticsContainer";

export type AnalyticsPersonaSwitchProps = {
  persona: AnalyticsPersona;
  userId: string;
};

function OverviewContainer({ persona, userId }: AnalyticsPersonaSwitchProps) {
  if (persona === "pi") {
    return <PiAnalyticsContainer userId={userId} />;
  }
  if (persona === "admin") {
    return <AdminAnalyticsContainer userId={userId} />;
  }
  return <ResearcherAnalyticsContainer userId={userId} />;
}

// Persona resolution happens server-side; this client switch routes the
// already-resolved persona to its Overview container and exposes the shared
// Resources tab above it. The TabsRouter URL state (`?tab=overview|resources`)
// sits above the persona-specific child state so navigating across personas
// preserves the active tab (spec §5.1).
export function AnalyticsPersonaSwitch({ persona, userId }: AnalyticsPersonaSwitchProps) {
  return (
    <TabsRouter
      defaultValue="overview"
      tabs={[
        {
          value: "overview",
          label: "Overview",
          content: <OverviewContainer persona={persona} userId={userId} />,
        },
        {
          value: "resources",
          label: "Resources",
          content: <ResourcesAnalyticsContainer persona={persona} userId={userId} />,
        },
      ]}
    />
  );
}
