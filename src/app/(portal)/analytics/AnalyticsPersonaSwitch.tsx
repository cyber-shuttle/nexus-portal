"use client";

import type { AnalyticsPersona } from "@/shared/auth/personaForAnalytics";
import { PlaceholderPage } from "@/shared/ui/PlaceholderPage";
import { ResearcherAnalyticsContainer } from "./ResearcherAnalyticsContainer";

export type AnalyticsPersonaSwitchProps = {
  persona: AnalyticsPersona;
  userId: string;
};

// Persona resolution happens server-side; this client switch only routes the
// already-resolved persona to its container so feature components stay
// presentational and the fan-out lives at the route layer (spec §5.2).
export function AnalyticsPersonaSwitch({ persona, userId }: AnalyticsPersonaSwitchProps) {
  if (persona === "pi") {
    return (
      <PlaceholderPage
        title="PI Analytics"
        phase={2}
        description="Available in Phase A2."
      />
    );
  }
  if (persona === "admin") {
    return (
      <PlaceholderPage
        title="Admin Analytics"
        phase={3}
        description="Available in Phase A3."
      />
    );
  }
  return <ResearcherAnalyticsContainer userId={userId} />;
}
