import type { Session } from "next-auth";

export type AnalyticsPersona = "admin" | "pi" | "researcher";

// Spec §5.4 first-match: system admins (systemRole axis) and
// allocation_manager → admin analytics; explicit pi role with at least one
// PI allocation → pi; everyone else (user, co_pi member-only, no PI
// allocations) → researcher. The allocation role is the primary PI gate so a
// `user` who owns a stale PI membership in seed data does not get promoted.
export function personaForAnalytics(session: Session | null | undefined): AnalyticsPersona {
  if (!session?.user) return "researcher";
  if (session.systemRole === "admin") return "admin";
  if (session.user.role === "allocation_manager") return "admin";
  if (session.user.role === "pi" && (session.user.myPiAllocations?.length ?? 0) > 0) return "pi";
  return "researcher";
}
