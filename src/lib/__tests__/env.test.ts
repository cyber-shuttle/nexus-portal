import { describe, expect, it } from "vitest";
import { serverSchema } from "../env";

describe("serverSchema OIDC validation", () => {
  it("parses successfully in dev mode without OIDC vars", () => {
    const result = serverSchema.safeParse({
      PORTAL_AUTH_MODE: "dev",
      NEXTAUTH_SECRET: "dev-secret-do-not-use-in-prod",
    });
    expect(result.success).toBe(true);
  });

  it("parses successfully in oidc mode with all required vars present", () => {
    const result = serverSchema.safeParse({
      PORTAL_AUTH_MODE: "oidc",
      NEXTAUTH_SECRET: "some-long-enough-secret",
      OIDC_ISSUER_URL: "https://auth.example.org/realms/default",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      NEXUS_ALLOWED_EMAILS: "a@b.org",
    });
    expect(result.success).toBe(true);
  });

  it("fails in oidc mode when any required var is missing", () => {
    const result = serverSchema.safeParse({
      PORTAL_AUTH_MODE: "oidc",
      NEXTAUTH_SECRET: "some-long-enough-secret",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.OIDC_ISSUER_URL?.[0]).toMatch(/required when PORTAL_AUTH_MODE='oidc'/);
      expect(fields.OIDC_CLIENT_ID?.[0]).toMatch(/required when PORTAL_AUTH_MODE='oidc'/);
      expect(fields.OIDC_CLIENT_SECRET?.[0]).toMatch(/required when PORTAL_AUTH_MODE='oidc'/);
      expect(fields.NEXUS_ALLOWED_EMAILS?.[0]).toMatch(/required when PORTAL_AUTH_MODE='oidc'/);
    }
  });

  it("treats whitespace-only OIDC values as missing", () => {
    const result = serverSchema.safeParse({
      PORTAL_AUTH_MODE: "oidc",
      OIDC_ISSUER_URL: "https://auth.example.org/realms/default",
      OIDC_CLIENT_ID: "client",
      OIDC_CLIENT_SECRET: "secret",
      NEXUS_ALLOWED_EMAILS: "   ",
    });
    expect(result.success).toBe(false);
  });
});
