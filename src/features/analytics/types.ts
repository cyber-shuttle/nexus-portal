import type { AnalyticsPersona } from "@shared/auth/personaForAnalytics";

// Re-export the persona union so analytics consumers don't reach into shared/auth.
export type Persona = AnalyticsPersona;

// Date-window contract shared by every analytics card on a page (spec §5.3).
// Mirrors the shape produced by `useUrlRange` so route layers can pass the
// hook output straight through.
export type AnalyticsRange = {
  from: Date;
  to: Date;
  preset: "24h" | "7d" | "30d" | "90d" | "custom";
};

// Single KPI value rendered by `KpiCard` in the analytics strip.
export type KpiValue = {
  title: string;
  value: number | string;
  delta?: { value: number; unit?: string; direction: "up" | "down" };
  deltaTone?: "positive" | "negative" | "neutral";
  sparkline?: number[];
};

// Placeholder for the per-persona dashboard payload. The A1–A3 phases will
// extend this with persona-shaped subtrees (researcher, pi, admin).
export type AnalyticsDashboard = {
  persona: Persona;
  range: AnalyticsRange;
  syncedAt: string;
  kpis: KpiValue[];
};
