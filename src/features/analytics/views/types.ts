import type { AnalyticsPersona } from "@shared/auth/personaForAnalytics";

// Saved view = a named bundle of URL state (range + multi-slot group-by)
// scoped to a single persona for a single user (spec §5.3 + §9 Phase A4).
// The MSW backend stores these under `seed.savedViews`; the contract is
// documented in docs/backend-contracts/analytics.md.
export type SavedView = {
  id: string;
  user_id: string;
  name: string;
  persona: AnalyticsPersona;
  range: {
    from: string;
    to: string;
    preset: "24h" | "7d" | "30d" | "90d" | "custom";
  };
  group_by: string[];
  // Reserved for v2 (named filter dimensions like project / member id);
  // stays `{}` in v1 so the schema can grow without a migration.
  filters: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

// POST payload — everything the user-facing form captures plus the URL
// state we snapshot at save time. `id`, `user_id`, timestamps assigned
// server-side.
export type CreateSavedViewPayload = {
  name: string;
  persona: AnalyticsPersona;
  range: SavedView["range"];
  group_by: string[];
  filters?: Record<string, unknown>;
  is_default?: boolean;
};

// PUT payload — rename and / or pin as default. `range` + `group_by` are
// immutable post-create in v1; the "Update view to current URL state"
// affordance is an A6+ follow-up.
export type UpdateSavedViewPayload = {
  name?: string;
  is_default?: boolean;
};

// Cap surfaced to the user — backend enforces the same constant. Keep in
// sync with the MSW handler.
export const SAVED_VIEW_LIMIT_PER_PERSONA = 5;
