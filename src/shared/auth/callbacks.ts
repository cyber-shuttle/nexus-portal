import { isEmailAllowed } from "@/lib/allowlist";
import { fetchSystemRole, type SystemRoleResponse } from "@/shared/auth/systemRole";
import type { Role } from "@/shared/casl/abilities";
import type { NextAuthConfig } from "next-auth";
import { cookies } from "next/headers";

// Persona pick from the sign-in card is held in a short-lived cookie across
// the OIDC redirect, then mapped to an allocation Role. The system axis
// (admin) is sourced from the backend on every sign-in — the persona cookie
// only drives allocation-axis selection, so persona='admin' yields the
// least-privilege allocation role.
export function personaToRole(persona: string | undefined): Role {
  if (persona === "pi") return "pi";
  return "user";
}

type CallbackOptions = {
  allowedEmails: string | undefined;
  oidcEnabled: boolean;
  coreApiBaseUrl: string;
  // Override hook for tests. Production wires the real fetcher.
  fetchSystemRoleImpl?: (userId: string, baseUrl: string) => Promise<SystemRoleResponse>;
};

export function buildAuthCallbacks(options: CallbackOptions): NextAuthConfig["callbacks"] {
  const { allowedEmails, oidcEnabled, coreApiBaseUrl } = options;
  const fetchSystemRoleFn = options.fetchSystemRoleImpl ?? fetchSystemRole;
  return {
    async signIn({ user, account }) {
      if (account?.provider === "oidc") {
        const email = user.email ?? "";
        if (!isEmailAllowed(email, allowedEmails)) {
          // NextAuth treats a string return as a redirect URL — bounce to the
          // sign-in page with the email so the banner can show who was denied.
          return `/sign-in?error=not_allowed&email=${encodeURIComponent(email)}`;
        }
        return true;
      }
      // GitHub sign-in is unrestricted: the OAuth app itself is the gate
      // (org-owned), and issues file under the user's own identity.
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "oidc" && user) {
        const cookieStore = await cookies();
        const persona = cookieStore.get("nexus_pending_persona")?.value;
        token.provider = "oidc";
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
      } else if (account?.provider === "github" && user) {
        token.provider = "github";
        token.role = "user";
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.personId = user.email ?? token.personId;
        // GitHub-authed users haven't picked a portal persona — empty scopes
        // mirror the OIDC default so CASL gates deny by default.
        token.myMemberProjects = [];
        token.myPiProjects = [];
        token.myPiAllocations = [];
        token.assignedAllocations = [];
      } else if (account?.provider === "github-dev" && user) {
        // Same discriminator as the real provider so downstream gates see one
        // shape; access token comes from the dev short-circuit below.
        token.provider = "github";
        token.role = "user";
        token.email = user.email ?? token.email;
        token.name = user.name ?? token.name;
        token.personId = user.email ?? token.personId;
        token.myMemberProjects = [];
        token.myPiProjects = [];
        token.myPiAllocations = [];
        token.assignedAllocations = [];
      } else if (user) {
        token.provider = "credentials";
        token.role = user.role;
        token.personId = user.personId;
        token.myPiAllocations = user.myPiAllocations;
        token.myPiProjects = user.myPiProjects;
        token.myMemberProjects = user.myMemberProjects;
        token.assignedAllocations = user.assignedAllocations;
        // Dev personas carry the system axis directly on the user object —
        // no backend exists to fetch from in this branch.
        token.systemRole = user.systemRole ?? null;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
      } else if (!token.accessToken && !oidcEnabled) {
        token.accessToken = "dev-token";
      }
      // System role is DB-authoritative for IdP-backed providers; the core
      // API is the only source of truth and the portal never falls back to
      // IdP claims on failure.
      const usesBackendForSystemRole =
        account?.provider === "oidc" ||
        account?.provider === "github" ||
        account?.provider === "github-dev";
      if (user && usesBackendForSystemRole) {
        if (!token.personId) {
          token.systemRole = null;
        } else {
          try {
            const result = await fetchSystemRoleFn(token.personId, coreApiBaseUrl);
            token.systemRole = result.role;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`system-role fetch failed; signing in with no scopes: ${message}`);
            token.systemRole = null;
            token.myPiAllocations = [];
            token.myPiProjects = [];
            token.myMemberProjects = [];
            token.assignedAllocations = [];
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token.accessToken) session.accessToken = token.accessToken;
      if (token.provider) session.provider = token.provider;
      session.systemRole = token.systemRole ?? null;
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
