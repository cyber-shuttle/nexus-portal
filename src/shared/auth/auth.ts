import { serverEnv } from "@/lib/env";
import { buildAuthCallbacks } from "@/shared/auth/callbacks";
import { derivePersonaScopes } from "@/shared/auth/personaScopes";
import type { Role } from "@/shared/casl/abilities";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Keycloak from "next-auth/providers/keycloak";
import { z } from "zod";

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
        myMemberProjects: scopes.myMemberProjects,
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
      myMemberProjects: scopes.myMemberProjects,
      assignedAllocations: scopes.assignedAllocations,
    };
  },
});

const oidcEnabled = serverEnv.PORTAL_AUTH_MODE === "oidc";
const githubEnabled = !!(
  serverEnv.GITHUB_OAUTH_CLIENT_ID && serverEnv.GITHUB_OAUTH_CLIENT_SECRET
);
// Stand-in for the real GitHub OAuth dance so e2e suites can drive the
// suggestion-mode flow without hitting github.com. Non-production only.
const githubDevShimEnabled =
  process.env.NODE_ENV !== "production" && serverEnv.PORTAL_AUTH_MODE === "dev";

const githubDevProvider = Credentials({
  id: "github-dev",
  name: "GitHub (dev shim)",
  credentials: { email: { label: "Email", type: "email" } },
  authorize: async (raw) => {
    const parsed = z.object({ email: z.string().email() }).safeParse(raw);
    if (!parsed.success) return null;
    const email = parsed.data.email.toLowerCase();
    return { id: email, email, name: email.split("@")[0], role: "user" as Role };
  },
});

const providers: NextAuthConfig["providers"] = [
  ...(serverEnv.PORTAL_AUTH_MODE === "dev" ? [credentialsProvider] : []),
  ...(githubDevShimEnabled ? [githubDevProvider] : []),
  ...(oidcEnabled
    ? [
        Keycloak({
          // Lock the callback path to /api/auth/callback/oidc so the Keycloak
          // client registration is stable regardless of provider class. The
          // env schema (superRefine) guarantees these four vars are present
          // and non-empty when PORTAL_AUTH_MODE === 'oidc'.
          id: "oidc",
          issuer: serverEnv.OIDC_ISSUER_URL ?? "",
          clientId: serverEnv.OIDC_CLIENT_ID ?? "",
          clientSecret: serverEnv.OIDC_CLIENT_SECRET ?? "",
          authorization: { params: { scope: "openid email profile" } },
        }),
      ]
    : []),
  ...(githubEnabled
    ? [
        GitHub({
          clientId: serverEnv.GITHUB_OAUTH_CLIENT_ID ?? "",
          clientSecret: serverEnv.GITHUB_OAUTH_CLIENT_SECRET ?? "",
          // repo: file issues in private nexus-portal; user:email: read all
          // verified addresses so the allowlist check covers institutional
          // emails that aren't the GitHub primary.
          authorization: { params: { scope: "repo user:email" } },
        }),
      ]
    : []),
];

export const authConfig: NextAuthConfig = {
  trustHost: true,
  secret: serverEnv.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/sign-in" },
  providers,
  callbacks: buildAuthCallbacks({
    allowedEmails: serverEnv.NEXUS_ALLOWED_EMAILS,
    oidcEnabled,
  }),
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
