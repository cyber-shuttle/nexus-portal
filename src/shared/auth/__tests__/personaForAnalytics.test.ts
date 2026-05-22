import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";
import { personaForAnalytics } from "../personaForAnalytics";

function makeSession(overrides: Partial<Session["user"]>): Session {
  return {
    expires: "9999-01-01",
    user: { id: "u-1", role: "user", myPiAllocations: [], assignedAllocations: [], ...overrides },
  } as Session;
}

describe("personaForAnalytics", () => {
  it("resolves admin role to admin persona", () => {
    expect(personaForAnalytics(makeSession({ role: "admin" }))).toBe("admin");
  });

  it("resolves allocation_manager to admin persona", () => {
    expect(personaForAnalytics(makeSession({ role: "allocation_manager" }))).toBe("admin");
  });

  it("resolves PI memberships to pi persona", () => {
    expect(
      personaForAnalytics(makeSession({ role: "pi", myPiAllocations: ["alloc-1"] })),
    ).toBe("pi");
  });

  it("keeps co_pi member-only as researcher per spec §5.4", () => {
    expect(
      personaForAnalytics(makeSession({ role: "co_pi", myPiAllocations: ["alloc-2"] })),
    ).toBe("researcher");
  });

  it("keeps user role as researcher even with stale PI seed memberships", () => {
    expect(
      personaForAnalytics(makeSession({ role: "user", myPiAllocations: ["alloc-stale"] })),
    ).toBe("researcher");
  });

  it("defaults to researcher when no PI memberships exist", () => {
    expect(personaForAnalytics(makeSession({ role: "user" }))).toBe("researcher");
  });

  it("returns researcher when session is null", () => {
    expect(personaForAnalytics(null)).toBe("researcher");
  });
});
