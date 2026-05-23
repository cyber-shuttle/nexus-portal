"use client";

import type { AnalyticsPersona } from "@/shared/auth/personaForAnalytics";
import { AdminAnalyticsContainer } from "./AdminAnalyticsContainer";
import { PiAnalyticsContainer } from "./PiAnalyticsContainer";
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
    return <PiAnalyticsContainer userId={userId} />;
  }
  if (persona === "admin") {
    return <AdminAnalyticsContainer />;
  }
  return <ResearcherAnalyticsContainer userId={userId} />;
}
