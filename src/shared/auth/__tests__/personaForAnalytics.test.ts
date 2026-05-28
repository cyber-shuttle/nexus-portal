import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";
import type { SystemRole } from "@/shared/casl/abilities";
import { personaForAnalytics } from "../personaForAnalytics";

function makeSession(
  overrides: Partial<Session["user"]> & { systemRole?: SystemRole | null } = {},
): Session {
  const { systemRole, ...userOverrides } = overrides;
  return {
    expires: "9999-01-01",
    systemRole: systemRole ?? null,
    user: {
      id: "u-1",
      role: "user",
      myPiAllocations: [],
      assignedAllocations: [],
      ...userOverrides,
    },
  } as Session;
}

describe("personaForAnalytics", () => {
  it("resolves systemRole=admin to admin analytics persona", () => {
    expect(personaForAnalytics(makeSession({ systemRole: "admin" }))).toBe("admin");
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

  it("system admin who is also a PI resolves to admin (system axis wins)", () => {
    expect(
      personaForAnalytics(
        makeSession({ role: "pi", myPiAllocations: ["alloc-1"], systemRole: "admin" }),
      ),
    ).toBe("admin");
  });
});
