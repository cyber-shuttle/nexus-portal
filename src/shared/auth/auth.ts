import { serverEnv } from "@/lib/env";
import { derivePersonaScopes } from "@/shared/auth/personaScopes";
import type { Role } from "@/shared/casl/abilities";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

const ROLE_VALUES: Role[] = ["guest", "user", "pi", "co_pi", "allocation_manager", "admin"];

function deriveRoleFromClaims(profile: Record<string, unknown> | undefined): Role | null {
  if (!profile || typeof profile !== "object") return null;
  if (profile.nexus_admin === true || profile.nexus_admin === "true") return "admin";
  const claim = profile.nexus_role;
  if (typeof claim === "string" && ROLE_VALUES.includes(claim as Role)) {
    return claim as Role;
  }
  const realmRoles = (profile as { realm_access?: { roles?: unknown[] } }).realm_access?.roles;
  if (Array.isArray(realmRoles) && realmRoles.includes("nexus_admin")) return "admin";
  return null;
}

async function fetchScopesFallback(
  accessToken: string,
): Promise<{
  role: Role;
  myPiAllocations: string[];
  myPiProjects: string[];
  assignedAllocations: string[];
} | null> {
  try {
    const base = serverEnv.CORE_API_BASE_URL?.replace(/\/+$/, "") ?? "";
    if (!base) return null;
    const res = await fetch(`${base}/me/scopes`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    if (!parsed || typeof parsed !== "object") return null;
    const role = ROLE_VALUES.includes((parsed as { role?: string }).role as Role)
      ? ((parsed as { role: Role }).role as Role)
      : "user";
    return {
      role,
      myPiAllocations: Array.isArray((parsed as { myPiAllocations?: unknown }).myPiAllocations)
        ? ((parsed as { myPiAllocations: string[] }).myPiAllocations as string[])
        : [],
      // `myPiProjects` powers the AnalyticsPI CASL gate (spec §5.5) — must
      // round-trip from /me/scopes the same way as myPiAllocations.
      myPiProjects: Array.isArray((parsed as { myPiProjects?: unknown }).myPiProjects)
        ? ((parsed as { myPiProjects: string[] }).myPiProjects as string[])
        : [],
      assignedAllocations: Array.isArray(
        (parsed as { assignedAllocations?: unknown }).assignedAllocations,
      )
        ? ((parsed as { assignedAllocations: string[] }).assignedAllocations as string[])
        : [],
    };
  } catch {
    return null;
  }
}

const devPersonas: Record<string, { name: string; role: Role }> = {
  "researcher@nexus.local": { name: "Riya Researcher", role: "user" },
  "pi@nexus.local": { name: "Pat PI", role: "pi" },
  "admin@nexus.local": { name: "Avery Admin", role: "admin" },
};

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const credentialsProvider = Credentials({
  id: "credentials",
  name: "Dev credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (raw) => {
    const parsed = credentialsSchema.safeParse(raw);
    if (!parsed.success) return null;

    const email = parsed.data.email.toLowerCase();
    const preset = devPersonas[email];
    const scopes = derivePersonaScopes(email);
    if (preset) {
      return {
        id: email,
        email,
        name: preset.name,
        role: preset.role,
        myPiAllocations: scopes.myPiAllocations,
        myPiProjects: scopes.myPiProjects,
        assignedAllocations: scopes.assignedAllocations,
      };
    }
    return {
      id: email,
      email,
      name: email.split("@")[0],
      role: "user" as Role,
      myPiAllocations: scopes.myPiAllocations,
      myPiProjects: scopes.myPiProjects,
      assignedAllocations: scopes.assignedAllocations,
    };
  },
});

const oidcEnabled = serverEnv.PORTAL_AUTH_MODE === "oidc" && Boolean(serverEnv.OIDC_ISSUER_URL);

const providers: NextAuthConfig["providers"] = [credentialsProvider];

if (oidcEnabled) {
  providers.push({
    id: "oidc",
    name: "OIDC",
    type: "oidc",
    issuer: serverEnv.OIDC_ISSUER_URL,
    clientId: serverEnv.OIDC_CLIENT_ID,
    clientSecret: serverEnv.OIDC_CLIENT_SECRET,
    authorization: { params: { scope: "openid profile email" } },
  });
}

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: serverEnv.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers,
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.role = user.role;
        token.personId = user.personId;
        token.myPiAllocations = user.myPiAllocations;
        token.myPiProjects = user.myPiProjects;
        token.assignedAllocations = user.assignedAllocations;
      }
      if (account?.access_token) {
        token.accessToken = account.access_token;
      } else if (!token.accessToken && !oidcEnabled) {
        token.accessToken = "dev-token";
      }
      // OIDC sign-in: derive role from claims first; if the IdP doesn't include
      // a role claim, fall back to /me/scopes against the core API. Both paths
      // are tolerant — a missing role degrades to `user`.
      if (oidcEnabled && account?.provider === "oidc") {
        const claimRole = deriveRoleFromClaims(
          (profile ?? undefined) as Record<string, unknown> | undefined,
        );
        if (claimRole) {
          token.role = claimRole;
          token.myPiAllocations = [];
          token.myPiProjects = [];
          token.assignedAllocations = [];
        } else if (typeof token.accessToken === "string") {
          const fallback = await fetchScopesFallback(token.accessToken);
          if (fallback) {
            token.role = fallback.role;
            token.myPiAllocations = fallback.myPiAllocations;
            token.myPiProjects = fallback.myPiProjects;
            token.assignedAllocations = fallback.assignedAllocations;
          } else if (!token.role) {
            token.role = "user";
          }
        }
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
        session.user.assignedAllocations = token.assignedAllocations;
        if (typeof token.sub === "string") {
          session.user.id = token.sub;
        }
      }
      return session;
    },
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
