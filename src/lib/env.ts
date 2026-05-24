import { z } from "zod";

export const serverSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORTAL_AUTH_MODE: z.enum(["dev", "oidc"]).default("dev"),
    NEXTAUTH_SECRET: z.string().min(8).default("dev-secret-do-not-use-in-prod"),
    NEXTAUTH_URL: z.string().url().optional(),

    CORE_API_BASE_URL: z.string().url().default("http://localhost:8080"),
    AMIE_API_BASE_URL: z.string().url().default("http://localhost:8081"),
    SIGNER_API_BASE_URL: z.string().url().default("http://localhost:8082"),

    CORE_CLIENT_ID: z.string().default(""),
    CORE_CLIENT_SECRET: z.string().default(""),

    OIDC_ISSUER_URL: z.string().url().optional(),
    OIDC_CLIENT_ID: z.string().optional(),
    OIDC_CLIENT_SECRET: z.string().optional(),
    NEXUS_ALLOWED_EMAILS: z.string().optional(),

    FEEDBACK_GITHUB_TOKEN: z.string().min(20).optional(),
    FEEDBACK_GITHUB_REPO: z
      .string()
      .regex(/^[^/\s]+\/[^/\s]+$/, "expected owner/repo")
      .default("lahirujayathilake/nexus-portal"),
    FEEDBACK_LABEL: z.string().min(1).default("suggestion"),
  })
  .superRefine((env, ctx) => {
    // OIDC mode demands these four vars — otherwise NextAuth boots a
    // misconfigured provider that silently fails at sign-in.
    if (env.PORTAL_AUTH_MODE === "oidc") {
      const required: Array<["OIDC_ISSUER_URL" | "OIDC_CLIENT_ID" | "OIDC_CLIENT_SECRET" | "NEXUS_ALLOWED_EMAILS", string | undefined]> = [
        ["OIDC_ISSUER_URL", env.OIDC_ISSUER_URL],
        ["OIDC_CLIENT_ID", env.OIDC_CLIENT_ID],
        ["OIDC_CLIENT_SECRET", env.OIDC_CLIENT_SECRET],
        ["NEXUS_ALLOWED_EMAILS", env.NEXUS_ALLOWED_EMAILS],
      ];
      for (const [name, value] of required) {
        if (!value || value.trim().length === 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [name],
            message: `${name} is required when PORTAL_AUTH_MODE='oidc'`,
          });
        }
      }
    }
    // Feedback widget enforces FEEDBACK_GITHUB_TOKEN inside the POST handler
    // at request time rather than at schema-parse time. Schema-parse runs
    // during `next build` page-data collection (NODE_ENV=production) — gating
    // on it here would block builds even when no token is intended yet.
  });

const clientSchema = z.object({
  NEXT_PUBLIC_PORTAL_USE_MSW: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_PORTAL_AUTH_MODE: z.enum(["dev", "oidc"]).default("dev"),
  NEXT_PUBLIC_BUILD_SHA: z.string().min(1).default("dev"),
});

function parseServer() {
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid server env:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid server env");
  }
  return parsed.data;
}

function parseClient() {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_PORTAL_USE_MSW: process.env.NEXT_PUBLIC_PORTAL_USE_MSW,
    NEXT_PUBLIC_PORTAL_AUTH_MODE: process.env.NEXT_PUBLIC_PORTAL_AUTH_MODE,
    NEXT_PUBLIC_BUILD_SHA: process.env.NEXT_PUBLIC_BUILD_SHA,
  });
  if (!parsed.success) {
    console.error("Invalid client env:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid client env");
  }
  return parsed.data;
}

export const serverEnv = parseServer();
export const clientEnv = parseClient();
