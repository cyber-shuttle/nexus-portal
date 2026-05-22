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

  it("resolves co_pi with PI memberships to pi persona", () => {
    expect(
      personaForAnalytics(makeSession({ role: "co_pi", myPiAllocations: ["alloc-2"] })),
    ).toBe("pi");
  });

  it("defaults to researcher when no PI memberships exist", () => {
    expect(personaForAnalytics(makeSession({ role: "user" }))).toBe("researcher");
  });

  it("returns researcher when session is null", () => {
    expect(personaForAnalytics(null)).toBe("researcher");
  });
});
