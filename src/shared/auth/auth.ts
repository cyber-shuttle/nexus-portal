import { serverEnv } from "@/lib/env";
import { buildAuthCallbacks } from "@/shared/auth/callbacks";
import { derivePersonaScopes } from "@/shared/auth/personaScopes";
import type { Role } from "@/shared/casl/abilities";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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

const providers: NextAuthConfig["providers"] = [
  ...(serverEnv.PORTAL_AUTH_MODE === "dev" ? [credentialsProvider] : []),
  ...(oidcEnabled
    ? [
        Keycloak({
          // Lock the callback path to /api/auth/callback/oidc so the Keycloak
          // client registration is stable regardless of provider class.
          id: "oidc",
          issuer: serverEnv.OIDC_ISSUER_URL!,
          clientId: serverEnv.OIDC_CLIENT_ID!,
          clientSecret: serverEnv.OIDC_CLIENT_SECRET!,
          authorization: { params: { scope: "openid email profile" } },
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
