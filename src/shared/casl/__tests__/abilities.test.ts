import { subject } from "@casl/ability";
import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";
import { type Role, type SystemRole, defineAbility } from "../abilities";

type SessionInput = {
  role?: Role;
  systemRole?: SystemRole | null;
  userId?: string;
  myPiAllocations?: string[];
  myPiProjects?: string[];
  myMemberProjects?: string[];
  assignedAllocations?: string[];
};

function fixture(input: SessionInput = {}): Session {
  return {
    expires: "9999-01-01",
    systemRole: input.systemRole ?? null,
    user: {
      id: input.userId,
      role: input.role,
      myPiAllocations: input.myPiAllocations,
      myPiProjects: input.myPiProjects,
      myMemberProjects: input.myMemberProjects,
      assignedAllocations: input.assignedAllocations,
    },
  } as Session;
}

describe("defineAbility — allocation axis", () => {
  it("researcher cannot manage memberships and cannot create proposals", () => {
    const ability = defineAbility(fixture({ role: "user" }));
    expect(ability.can("read", "Allocation")).toBe(true);
    expect(ability.can("manage", "Membership")).toBe(false);
    expect(ability.can("create", "Proposal")).toBe(false);
    expect(ability.can("approve", "ChangeRequest")).toBe(false);
  });

  it("pi can manage memberships only for their own allocations", () => {
    const ability = defineAbility(
      fixture({ role: "pi", myPiAllocations: ["alloc-001"] }),
    );
    expect(ability.can("manage", subject("Membership", { allocationId: "alloc-001" }))).toBe(true);
    expect(ability.can("manage", subject("Membership", { allocationId: "alloc-other" }))).toBe(
      false,
    );
    expect(ability.can("create", "Proposal")).toBe(true);
  });

  it("allocation_manager can approve only their assigned requests", () => {
    const ability = defineAbility(
      fixture({ role: "allocation_manager", assignedAllocations: ["alloc-200"] }),
    );
    expect(ability.can("approve", subject("ChangeRequest", { allocationId: "alloc-200" }))).toBe(
      true,
    );
    expect(ability.can("approve", subject("ChangeRequest", { allocationId: "alloc-999" }))).toBe(
      false,
    );
  });

  it("guest has no abilities", () => {
    const ability = defineAbility(fixture({ role: "guest" }));
    expect(ability.can("read", "Allocation")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
  });

  it("missing session defaults to guest (no abilities)", () => {
    expect(defineAbility(null).can("read", "Allocation")).toBe(false);
    expect(defineAbility(undefined).can("manage", "all")).toBe(false);
  });

  it("researcher can read own analytics subject only", () => {
    const ability = defineAbility(fixture({ role: "user", userId: "u-1" }));
    expect(ability.can("read", subject("AnalyticsResearcher", { userId: "u-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsResearcher", { userId: "u-2" }))).toBe(false);
    expect(ability.can("read", "AnalyticsPI")).toBe(false);
  });

  it("pi can read AnalyticsPI for own projects and AnalyticsResearcher for self", () => {
    const ability = defineAbility(
      fixture({
        role: "pi",
        userId: "u-pi",
        myPiAllocations: ["alloc-1"],
        myPiProjects: ["proj-1"],
      }),
    );
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-other" }))).toBe(false);
    expect(ability.can("read", subject("AnalyticsResearcher", { userId: "u-pi" }))).toBe(true);
  });

  it("AnalyticsPI scoping: pi with myPiProjects=['proj-1'] passes for proj-1 only", () => {
    const ability = defineAbility(
      fixture({
        role: "pi",
        userId: "u-pi",
        myPiAllocations: ["alloc-1"],
        myPiProjects: ["proj-1"],
      }),
    );
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-other" }))).toBe(false);
  });

  it("AnalyticsPI scoping: researcher cannot read AnalyticsPI at all", () => {
    const ability = defineAbility(fixture({ role: "user", userId: "u-1" }));
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-1" }))).toBe(false);
    expect(ability.can("read", "AnalyticsPI")).toBe(false);
  });

  it("AnalyticsPI scoping: OIDC PI with myPiProjects from /me/scopes fallback passes the gate", () => {
    // OIDC sign-in must propagate `myPiProjects` from the /me/scopes fallback
    // so the AnalyticsPI rule isn't dead for OIDC PIs.
    const ability = defineAbility(
      fixture({
        role: "pi",
        userId: "u-pi-oidc",
        myPiAllocations: ["alloc-oidc-1"],
        myPiProjects: ["proj-oidc-1"],
      }),
    );
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-oidc-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-other" }))).toBe(false);
  });

  it("AnalyticsPI scoping: OIDC PI with empty myPiProjects cannot read AnalyticsPI", () => {
    const ability = defineAbility(
      fixture({ role: "pi", userId: "u-pi-oidc", myPiAllocations: [], myPiProjects: [] }),
    );
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-oidc-1" }))).toBe(false);
  });

  it("researcher can read projects they are a member of and cannot create projects", () => {
    const ability = defineAbility(
      fixture({
        role: "user",
        userId: "researcher@nexus.local",
        myMemberProjects: ["proj-1", "proj-2"],
      }),
    );
    expect(ability.can("read", subject("Project", { id: "proj-1" }))).toBe(true);
    expect(ability.can("read", subject("Project", { id: "proj-other" }))).toBe(false);
    expect(ability.can("create", "Project")).toBe(false);
    expect(ability.can("manage", subject("Project", { id: "proj-1" }))).toBe(false);
  });

  it("pi can read own + member projects, create projects, and manage own", () => {
    const ability = defineAbility(
      fixture({
        role: "pi",
        userId: "u-pi",
        myPiAllocations: ["alloc-1"],
        myPiProjects: ["proj-owned"],
        myMemberProjects: ["proj-owned", "proj-member-only"],
      }),
    );
    expect(ability.can("read", subject("Project", { id: "proj-owned" }))).toBe(true);
    expect(ability.can("read", subject("Project", { id: "proj-member-only" }))).toBe(true);
    expect(ability.can("read", subject("Project", { id: "proj-stranger" }))).toBe(false);
    expect(ability.can("create", "Project")).toBe(true);
    expect(ability.can("manage", subject("Project", { id: "proj-owned" }))).toBe(true);
    expect(ability.can("manage", subject("Project", { id: "proj-member-only" }))).toBe(false);
  });

  it("researcher can read clusters but cannot manage them (EnableToggle stays disabled)", () => {
    const ability = defineAbility(
      fixture({ role: "user", userId: "researcher@nexus.local" }),
    );
    expect(ability.can("read", "Cluster")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(false);
  });

  it("pi can read clusters but cannot manage them (cluster enablement is admin-only)", () => {
    const ability = defineAbility(
      fixture({
        role: "pi",
        userId: "u-pi",
        myPiAllocations: ["alloc-1"],
        myPiProjects: ["proj-1"],
      }),
    );
    expect(ability.can("read", "Cluster")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(false);
  });
});

describe("defineAbility — system axis layering", () => {
  it("admin-only (guest allocation, systemRole=admin) can manage everything but lacks PI gates", () => {
    const ability = defineAbility(fixture({ role: "guest", systemRole: "admin" }));
    // System axis grants the wildcard.
    expect(ability.can("manage", "AmiePacket")).toBe(true);
    expect(ability.can("manage", "Resource")).toBe(true);
    expect(ability.can("manage", "Rate")).toBe(true);
    expect(ability.can("manage", "UnmappedJob")).toBe(true);
    expect(ability.can("manage", "Adjustment")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(true);
    // Wildcard subsumes Allocation reads too.
    expect(ability.can("read", "Allocation")).toBe(true);
    expect(ability.can("create", "Project")).toBe(true);
    // PI subject-bound rules require allocation-axis role; admin gets wildcard
    // approve for any ChangeRequest, but only via `manage all` — not via a
    // myPiAllocations-scoped rule. Verify the wildcard reaches subject-bound
    // checks.
    expect(
      ability.can("approve", subject("ChangeRequest", { allocationId: "alloc-anything" })),
    ).toBe(true);
  });

  it("pi-only (no systemRole) cannot reach admin-only manage actions", () => {
    const ability = defineAbility(
      fixture({
        role: "pi",
        userId: "u-pi",
        myPiAllocations: ["alloc-1"],
        myPiProjects: ["proj-1"],
      }),
    );
    expect(ability.can("manage", "AmiePacket")).toBe(false);
    expect(ability.can("manage", "Resource")).toBe(false);
    expect(ability.can("manage", "Rate")).toBe(false);
    expect(ability.can("manage", "UnmappedJob")).toBe(false);
    expect(ability.can("manage", "Adjustment")).toBe(false);
    expect(ability.can("manage", "Cluster")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
    // PI-only grants survive.
    expect(ability.can("create", "Proposal")).toBe(true);
    expect(ability.can("manage", subject("Membership", { allocationId: "alloc-1" }))).toBe(true);
  });

  it("admin+pi overlap session layers both axes — admin grants AND PI grants are present", () => {
    // The key proof: two axes are independent inputs to CASL. A PI promoted to
    // system admin keeps every PI-scoped grant AND gains the wildcard.
    const ability = defineAbility(
      fixture({
        role: "pi",
        systemRole: "admin",
        userId: "u-pi-admin",
        myPiAllocations: ["alloc-1"],
        myPiProjects: ["proj-1"],
      }),
    );
    // Admin axis
    expect(ability.can("manage", "AmiePacket")).toBe(true);
    expect(ability.can("manage", "Resource")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(true);
    expect(ability.can("manage", "all")).toBe(true);
    // PI axis (scoped rules still match)
    expect(ability.can("manage", subject("Membership", { allocationId: "alloc-1" }))).toBe(true);
    expect(ability.can("create", "Proposal")).toBe(true);
    expect(ability.can("manage", subject("Project", { id: "proj-1" }))).toBe(true);
  });

  it("failed-fetch session (guest + null systemRole + empty scopes) can do nothing", () => {
    const ability = defineAbility(
      fixture({
        role: "guest",
        systemRole: null,
        myPiAllocations: [],
        assignedAllocations: [],
        myPiProjects: [],
        myMemberProjects: [],
      }),
    );
    expect(ability.can("read", "Allocation")).toBe(false);
    expect(ability.can("read", "Profile")).toBe(false);
    expect(ability.can("read", "Cluster")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
    expect(ability.can("manage", "AmiePacket")).toBe(false);
  });

  it("admin axis grants explicit greppable Analytics manage rule", () => {
    const ability = defineAbility(fixture({ role: "user", systemRole: "admin" }));
    expect(ability.can("manage", "Analytics")).toBe(true);
    expect(ability.can("read", "AnalyticsAdmin")).toBe(true);
    expect(ability.can("read", "AnalyticsPI")).toBe(true);
    expect(ability.can("read", "AnalyticsResearcher")).toBe(true);
  });

  it("admin can manage all projects and all clusters", () => {
    const ability = defineAbility(fixture({ role: "user", systemRole: "admin" }));
    expect(ability.can("manage", subject("Project", { id: "any-project" }))).toBe(true);
    expect(ability.can("create", "Project")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(true);
  });
});
