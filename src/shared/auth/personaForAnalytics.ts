import type { Session } from "next-auth";

export type AnalyticsPersona = "admin" | "pi" | "researcher";

// First-match wins: admin/allocation_manager → admin, any PI membership → pi,
// otherwise researcher. Mirrors the /home persona-resolution spec §5.4.
export function personaForAnalytics(session: Session | null | undefined): AnalyticsPersona {
  const user = session?.user;
  if (!user) return "researcher";
  if (user.role === "admin" || user.role === "allocation_manager") return "admin";
  if ((user.myPiAllocations?.length ?? 0) > 0) return "pi";
  return "researcher";
}
