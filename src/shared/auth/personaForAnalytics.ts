import type { Session } from "next-auth";

export type AnalyticsPersona = "admin" | "pi" | "researcher";

// Spec §5.4 first-match: admin/allocation_manager → admin; explicit pi role with
// at least one PI allocation → pi; everyone else (user, co_pi member-only, no
// PI allocations) → researcher. Role is the primary gate so a `user` who
// accidentally owns a stale PI membership in seed data does not get promoted.
export function personaForAnalytics(session: Session | null | undefined): AnalyticsPersona {
  const user = session?.user;
  if (!user) return "researcher";
  if (user.role === "admin" || user.role === "allocation_manager") return "admin";
  if (user.role === "pi" && (user.myPiAllocations?.length ?? 0) > 0) return "pi";
  return "researcher";
}
