import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import type { Role } from "@/shared/casl/abilities";
import { serverEnv } from "@/lib/env";

const devPersonas: Record<string, { name: string; role: Role; myPiAllocations?: string[] }> = {
  "researcher@nexus.local": { name: "Riya Researcher", role: "user" },
  "pi@nexus.local": {
    name: "Pat PI",
    role: "pi",
    myPiAllocations: ["alloc-001"],
  },
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
    if (preset) {
      return {
        id: email,
        email,
        name: preset.name,
        role: preset.role,
        myPiAllocations: preset.myPiAllocations,
      };
    }
    return { id: email, email, name: email.split("@")[0], role: "user" as Role };
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
    async jwt({ token, user, account }) {
      if (user) {
        token.role = user.role;
        token.personId = user.personId;
        token.myPiAllocations = user.myPiAllocations;
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
