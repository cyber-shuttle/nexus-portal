import { isEmailAllowed } from "@/lib/allowlist";
import type { Role } from "@/shared/casl/abilities";
import type { NextAuthConfig } from "next-auth";
import { cookies } from "next/headers";

// Persona pick from the sign-in card is held in a short-lived cookie across
// the OIDC redirect, then mapped to a Role. Default to least-privilege.
export function personaToRole(persona: string | undefined): Role {
  if (persona === "admin") return "admin";
  if (persona === "pi") return "pi";
  return "user";
}

type CallbackOptions = {
  allowedEmails: string | undefined;
  oidcEnabled: boolean;
};

export function buildAuthCallbacks(options: CallbackOptions): NextAuthConfig["callbacks"] {
  const { allowedEmails, oidcEnabled } = options;
  return {
    async signIn({ user, account }) {
      if (account?.provider !== "oidc") return true;
      const email = user.email ?? "";
      if (!isEmailAllowed(email, allowedEmails)) {
        // NextAuth treats a string return as a redirect URL — bounce to the
        // sign-in page with the email so the banner can show who was denied.
        return `/sign-in?error=not_allowed&email=${encodeURIComponent(email)}`;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "oidc" && user) {
        const cookieStore = await cookies();
        const persona = cookieStore.get("nexus_pending_persona")?.value;
        token.role = personaToRole(persona);
        token.email = user.email ?? token.email;
        token.personId = user.email ?? token.personId;
        // OIDC users have no portal membership data yet — fail-safe to empty
        // so CASL gates that require explicit IDs deny by default.
        token.myMemberProjects = [];
        token.myPiProjects = [];
        token.myPiAllocations = [];
        token.assignedAllocations = [];
        // Single-use cookie: clear it so a future re-auth doesn't inherit a
        // stale persona pick from an earlier session.
        cookieStore.set("nexus_pending_persona", "", { maxAge: 0, path: "/" });
      } else if (user) {
        token.role = user.role;
        token.personId = user.personId;
        token.myPiAllocations = user.myPiAllocations;
        token.myPiProjects = user.myPiProjects;
        token.myMemberProjects = user.myMemberProjects;
        token.assignedAllocations = user.assignedAllocations;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
      } else if (!token.accessToken && !oidcEnabled) {
        token.accessToken = "dev-token";
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accessToken) session.accessToken = token.accessToken;
      if (session.user) {
        session.user.role = token.role;
        session.user.personId = token.personId;
        session.user.myPiAllocations = token.myPiAllocations;
        session.user.myPiProjects = token.myPiProjects;
        session.user.myMemberProjects = token.myMemberProjects;
        session.user.assignedAllocations = token.assignedAllocations;
        if (typeof token.sub === "string") {
          session.user.id = token.sub;
        }
      }
      return session;
    },
  };
}
