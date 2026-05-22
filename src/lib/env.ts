import { z } from "zod";

const serverSchema = z.object({
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
});

const clientSchema = z.object({
  NEXT_PUBLIC_PORTAL_USE_MSW: z.enum(["true", "false"]).default("false"),
  NEXT_PUBLIC_PORTAL_AUTH_MODE: z.enum(["dev", "oidc"]).default("dev"),
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
  });
  if (!parsed.success) {
    console.error("Invalid client env:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid client env");
  }
  return parsed.data;
}

export const serverEnv = parseServer();
export const clientEnv = parseClient();
