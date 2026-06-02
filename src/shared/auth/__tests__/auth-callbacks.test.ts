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

const TEST_CORE_BASE_URL = "http://core.test";

const fetchSystemRoleMock = vi.fn(async (_userId: string, _baseUrl: string) => ({
  role: null as "admin" | null,
}));

const callbacks = buildAuthCallbacks({
  allowedEmails: "allowed@example.org, second@example.org",
  oidcEnabled: true,
  coreApiBaseUrl: TEST_CORE_BASE_URL,
  fetchSystemRoleImpl: fetchSystemRoleMock,
});
const signIn = callbacks?.signIn;
const jwt = callbacks?.jwt;
if (!signIn || !jwt) throw new Error("auth callbacks missing");

beforeEach(() => {
  cookieJar.clear();
  cookieSet.mockClear();
  fetchSystemRoleMock.mockReset();
  fetchSystemRoleMock.mockResolvedValue({ role: null });
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
    const closed = buildAuthCallbacks({
      allowedEmails: "",
      oidcEnabled: true,
      coreApiBaseUrl: TEST_CORE_BASE_URL,
      fetchSystemRoleImpl: fetchSystemRoleMock,
    });
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
    cookieJar.set("nexus_pending_persona", "pi");
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(token.role).toBe("pi");
    expect(token.email).toBe("allowed@example.org");
    expect(token.personId).toBe("allowed@example.org");
    expect(token.myMemberProjects).toEqual([]);
    expect(token.myPiProjects).toEqual([]);
    expect(token.myPiAllocations).toEqual([]);
    expect(token.assignedAllocations).toEqual([]);
    expect(token.provider).toBe("oidc");
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

  it("maps persona='admin' cookie to allocation role 'user' (system axis now comes from /me/system-role)", async () => {
    // The persona cookie only drives the allocation axis; admin is no longer
    // a valid allocation role. The system axis is sourced from the backend.
    cookieJar.set("nexus_pending_persona", "admin");
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;
    expect(token.role).toBe("user");
  });

  it("stamps provider='credentials' and copies user scopes on the credentials path", async () => {
    const token = (await jwt({
      token: {},
      user: {
        email: "researcher@nexus.local",
        role: "user",
        personId: "researcher@nexus.local",
        myPiAllocations: ["a"],
        myPiProjects: ["p"],
        myMemberProjects: ["m"],
        assignedAllocations: ["x"],
      },
      account: { provider: "credentials" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(token.provider).toBe("credentials");
    expect(token.role).toBe("user");
    expect(token.personId).toBe("researcher@nexus.local");
    expect(token.myPiAllocations).toEqual(["a"]);
  });

  it("stamps provider='github', defaults role='user', copies email/name, and zeros scopes", async () => {
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org", name: "Octo Cat" },
      account: { provider: "github", access_token: "gh-token" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(token.provider).toBe("github");
    expect(token.role).toBe("user");
    expect(token.email).toBe("allowed@example.org");
    expect(token.name).toBe("Octo Cat");
    expect(token.personId).toBe("allowed@example.org");
    expect(token.myMemberProjects).toEqual([]);
    expect(token.myPiProjects).toEqual([]);
    expect(token.myPiAllocations).toEqual([]);
    expect(token.assignedAllocations).toEqual([]);
    expect(token.accessToken).toBe("gh-token");
  });
});

describe("session callback", () => {
  const session = callbacks?.session;
  if (!session) throw new Error("session callback missing");

  it("exposes token.provider on the session", async () => {
    const result = (await session({
      session: { user: {}, expires: "2099-01-01T00:00:00.000Z" },
      token: { provider: "github", accessToken: "gh", role: "user" },
    } as unknown as Parameters<typeof session>[0])) as unknown as Record<string, unknown>;
    expect(result.provider).toBe("github");
    expect(result.accessToken).toBe("gh");
  });

  it("leaves provider undefined when the token has none", async () => {
    const result = (await session({
      session: { user: {}, expires: "2099-01-01T00:00:00.000Z" },
      token: {},
    } as unknown as Parameters<typeof session>[0])) as unknown as Record<string, unknown>;
    expect(result.provider).toBeUndefined();
  });
});

describe("signIn callback — github", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  it("admits any github account without an allowlist check or network call", async () => {
    const result = await signIn({
      user: { email: "anyone@github.example" },
      account: { provider: "github", access_token: "tkn" },
    } as unknown as Parameters<typeof signIn>[0]);
    expect(result).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("jwt callback — system role", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("calls fetchSystemRole with personId and base URL on initial sign-in", async () => {
    fetchSystemRoleMock.mockResolvedValueOnce({ role: "admin" });
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(fetchSystemRoleMock).toHaveBeenCalledWith(
      "allowed@example.org",
      TEST_CORE_BASE_URL,
    );
    expect(token.systemRole).toBe("admin");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stores a null systemRole when the API reports no grant", async () => {
    fetchSystemRoleMock.mockResolvedValueOnce({ role: null });
    const token = (await jwt({
      token: {},
      user: { email: "allowed@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(token.systemRole).toBeNull();
  });

  it("fails closed: null systemRole, zeroed scopes, and warns on fetch error", async () => {
    fetchSystemRoleMock.mockRejectedValueOnce(new Error("boom"));
    cookieJar.set("nexus_pending_persona", "pi");
    const token = (await jwt({
      token: {},
      user: { email: "pi@example.org" },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(token.systemRole).toBeNull();
    expect(token.myPiAllocations).toEqual([]);
    expect(token.myPiProjects).toEqual([]);
    expect(token.myMemberProjects).toEqual([]);
    expect(token.assignedAllocations).toEqual([]);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0]?.[0] ?? "")).toContain("system-role fetch failed");
  });

  it("skips the fetch and stamps null when personId is missing", async () => {
    const token = (await jwt({
      token: {},
      user: { email: undefined as unknown as string },
      account: { provider: "oidc" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(fetchSystemRoleMock).not.toHaveBeenCalled();
    expect(token.systemRole).toBeNull();
  });

  it("stamps systemRole from the user object on the credentials path without fetching", async () => {
    const token = (await jwt({
      token: {},
      user: {
        email: "admin@nexus.local",
        role: "user",
        personId: "admin@nexus.local",
        systemRole: "admin",
        myPiAllocations: [],
        myPiProjects: [],
        myMemberProjects: [],
        assignedAllocations: [],
      },
      account: { provider: "credentials" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(fetchSystemRoleMock).not.toHaveBeenCalled();
    expect(token.systemRole).toBe("admin");
  });

  it("stamps null systemRole on the credentials path when the user omits it", async () => {
    const token = (await jwt({
      token: {},
      user: {
        email: "researcher@nexus.local",
        role: "user",
        personId: "researcher@nexus.local",
        myPiAllocations: [],
        myPiProjects: [],
        myMemberProjects: [],
        assignedAllocations: [],
      },
      account: { provider: "credentials" },
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(fetchSystemRoleMock).not.toHaveBeenCalled();
    expect(token.systemRole).toBeNull();
  });

  it("does not re-fetch on a session refresh (user undefined) and preserves existing systemRole", async () => {
    const token = (await jwt({
      token: {
        personId: "admin@nexus.local",
        systemRole: "admin",
        provider: "credentials",
        role: "user",
      },
      trigger: "update",
    } as unknown as Parameters<typeof jwt>[0])) as Record<string, unknown>;

    expect(fetchSystemRoleMock).not.toHaveBeenCalled();
    expect(token.systemRole).toBe("admin");
  });
});

describe("session callback — system role", () => {
  const session = callbacks?.session;
  if (!session) throw new Error("session callback missing");

  it("copies token.systemRole onto session.systemRole", async () => {
    const result = (await session({
      session: { user: {}, expires: "2099-01-01T00:00:00.000Z" },
      token: { systemRole: "admin" },
    } as unknown as Parameters<typeof session>[0])) as unknown as Record<string, unknown>;
    expect(result.systemRole).toBe("admin");
  });

  it("normalises a missing token.systemRole to null on the session", async () => {
    const result = (await session({
      session: { user: {}, expires: "2099-01-01T00:00:00.000Z" },
      token: {},
    } as unknown as Parameters<typeof session>[0])) as unknown as Record<string, unknown>;
    expect(result.systemRole).toBeNull();
  });
});
