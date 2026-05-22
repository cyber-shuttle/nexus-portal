import type { AnalyticsRange } from "./types";

// Stable query-key factory for analytics. Date range goes into the key so
// TanStack auto-refetches on URL-state change (spec §5.3).
export const analyticsKeys = {
  all: ["analytics"] as const,
  range: (params: AnalyticsRange) => [...analyticsKeys.all, "range", params] as const,
};
