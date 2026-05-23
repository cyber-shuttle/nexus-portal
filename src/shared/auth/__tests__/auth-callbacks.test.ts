import { beforeEach, describe, expect, it, vi } from "vitest";

// Stand-in cookie jar that mirrors the shape next/headers' cookies() returns.
// `cookies()` is awaited inside the jwt callback — the mock returns a thenable.
const cookieJar = new Map<string, string>();
const cookieSet = vi.fn(
  (name: string, value: string, _opts?: { maxAge?: number; path?: string }) => {
    if (value === "") cookieJar.delete(name);
    else cookieJar.set(name, value);
  },
);
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const v = cookieJar.get(name);
      return v === undefined ? undefined : { name, value: v };
    },
    set: cookieSet,
  }),
}));

import { buildAuthCallbacks } from "../callbacks";

const callbacks = buildAuthCallbacks({
  allowedEmails: "allowed@example.org, second@example.org",
  oidcEnabled: true,
});
const signIn = callbacks?.signIn;
const jwt = callbacks?.jwt;
if (!signIn || !jwt) throw new Error("auth callbacks missing");

beforeEach(() => {
  cookieJar.clear();
  cookieSet.mockClear();
});

describe("signIn callback", () => {
  it("returns true for an allowed email on the oidc provider", async () => {
    const result = await signIn({
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof signIn>[0]);
    expect(result).toBe(true);
  });

  it("returns the not_allowed redirect URL with the email param when denied", async () => {
    const result = await signIn({
      user: { email: "outsider@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof signIn>[0]);
    expect(result).toBe(
      `/sign-in?error=not_allowed&email=${encodeURIComponent("outsider@example.org")}`,
    );
  });

  it("matches the allowlist case-insensitively", async () => {
    const result = await signIn({
      user: { email: "ALLOWED@example.ORG" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof signIn>[0]);
    expect(result).toBe(true);
  });

  it("passes through (true) for non-OIDC providers without consulting the allowlist", async () => {
    const result = await signIn({
      user: { email: "outsider@example.org" },
      account: { provider: "credentials" },
    } as unknown as Parameters<typeof signIn>[0]);
    expect(result).toBe(true);
  });

  it("fails closed when the allowlist env is empty", async () => {
    const closed = buildAuthCallbacks({ allowedEmails: "", oidcEnabled: true });
    const closedSignIn = closed?.signIn;
    if (!closedSignIn) throw new Error("missing signIn");
    const result = await closedSignIn({
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof closedSignIn>[0]);
    expect(result).toBe(
      `/sign-in?error=not_allowed&email=${encodeURIComponent("allowed@example.org")}`,
    );
  });
});

describe("jwt callback", () => {
  it("maps persona cookie to role, copies email, clears scopes, and removes the cookie", async () => {
    cookieJar.set("nexus_pending_persona", "admin");
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(token.role).toBe("admin");
    expect(token.email).toBe("allowed@example.org");
    expect(token.personId).toBe("allowed@example.org");
    expect(token.myMemberProjects).toEqual([]);
    expect(token.myPiProjects).toEqual([]);
    expect(token.myPiAllocations).toEqual([]);
    expect(token.assignedAllocations).toEqual([]);
    expect(cookieSet).toHaveBeenCalledWith(
      "nexus_pending_persona",
      "",
      expect.objectContaining({ maxAge: 0, path: "/" }),
    );
    expect(cookieJar.has("nexus_pending_persona")).toBe(false);
  });

  it("defaults to 'user' (researcher) role when persona cookie is missing", async () => {
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;
    expect(token.role).toBe("user");
  });

  it("maps persona='pi' cookie to role 'pi'", async () => {
    cookieJar.set("nexus_pending_persona", "pi");
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;
    expect(token.role).toBe("pi");
  });
});
