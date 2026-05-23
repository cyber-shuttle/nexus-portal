import { subject } from "@casl/ability";
import { describe, expect, it } from "vitest";
import { defineAbilityForRole } from "../abilities";

describe("defineAbilityForRole", () => {
  it("admin can manage everything", () => {
    const ability = defineAbilityForRole("admin");
    expect(ability.can("manage", "AmiePacket")).toBe(true);
    expect(ability.can("read", "Allocation")).toBe(true);
    expect(ability.can("create", "Proposal")).toBe(true);
    expect(ability.can("approve", "ChangeRequest")).toBe(true);
  });

  it("researcher cannot manage memberships and cannot create proposals", () => {
    const ability = defineAbilityForRole("user");
    expect(ability.can("read", "Allocation")).toBe(true);
    expect(ability.can("manage", "Membership")).toBe(false);
    expect(ability.can("create", "Proposal")).toBe(false);
    expect(ability.can("approve", "ChangeRequest")).toBe(false);
  });

  it("pi can manage memberships only for their own allocations", () => {
    const ability = defineAbilityForRole("pi", { myPiAllocations: ["alloc-001"] });
    expect(ability.can("manage", subject("Membership", { allocationId: "alloc-001" }))).toBe(true);
    expect(ability.can("manage", subject("Membership", { allocationId: "alloc-other" }))).toBe(
      false,
    );
    expect(ability.can("create", "Proposal")).toBe(true);
  });

  it("allocation_manager can approve only their assigned requests", () => {
    const ability = defineAbilityForRole("allocation_manager", {
      assignedAllocations: ["alloc-200"],
    });
    expect(ability.can("approve", subject("ChangeRequest", { allocationId: "alloc-200" }))).toBe(
      true,
    );
    expect(ability.can("approve", subject("ChangeRequest", { allocationId: "alloc-999" }))).toBe(
      false,
    );
  });

  it("guest has no abilities", () => {
    const ability = defineAbilityForRole("guest");
    expect(ability.can("read", "Allocation")).toBe(false);
    expect(ability.can("manage", "all")).toBe(false);
  });

  it("researcher can read own analytics subject only", () => {
    const ability = defineAbilityForRole("user", { userId: "u-1" });
    expect(ability.can("read", subject("AnalyticsResearcher", { userId: "u-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsResearcher", { userId: "u-2" }))).toBe(false);
    expect(ability.can("read", "AnalyticsPI")).toBe(false);
  });

  it("pi can read AnalyticsPI for own projects and AnalyticsResearcher for self", () => {
    const ability = defineAbilityForRole("pi", {
      userId: "u-pi",
      myPiAllocations: ["alloc-1"],
      myPiProjects: ["proj-1"],
    });
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-other" }))).toBe(false);
    expect(ability.can("read", subject("AnalyticsResearcher", { userId: "u-pi" }))).toBe(true);
  });

  it("admin can manage Analytics across all subjects", () => {
    const ability = defineAbilityForRole("admin");
    expect(ability.can("read", "AnalyticsAdmin")).toBe(true);
    expect(ability.can("read", "AnalyticsPI")).toBe(true);
    expect(ability.can("read", "AnalyticsResearcher")).toBe(true);
  });

  it("admin has an explicit manage Analytics rule (greppable)", () => {
    const ability = defineAbilityForRole("admin");
    expect(ability.can("manage", "Analytics")).toBe(true);
  });

  it("AnalyticsPI scoping: pi with myPiProjects=['proj-1'] passes for proj-1 only", () => {
    // A2 contract per brief — keeps the spec §5.5 invariant grep-visible.
    const ability = defineAbilityForRole("pi", {
      userId: "u-pi",
      myPiAllocations: ["alloc-1"],
      myPiProjects: ["proj-1"],
    });
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-other" }))).toBe(false);
  });

  it("AnalyticsPI scoping: researcher cannot read AnalyticsPI at all", () => {
    const ability = defineAbilityForRole("user", { userId: "u-1" });
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-1" }))).toBe(false);
    expect(ability.can("read", "AnalyticsPI")).toBe(false);
  });

  it("AnalyticsPI scoping: OIDC PI with myPiProjects from /me/scopes fallback passes the gate", () => {
    // A3 carry-over N1 — OIDC sign-in must propagate `myPiProjects` from the
    // /me/scopes fallback so the AnalyticsPI rule isn't dead for OIDC PIs.
    // Mirrors what an OIDC PI session token looks like after the fallback
    // populates the JWT (auth.ts JWT callback).
    const ability = defineAbilityForRole("pi", {
      userId: "u-pi-oidc",
      myPiAllocations: ["alloc-oidc-1"],
      myPiProjects: ["proj-oidc-1"],
    });
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-oidc-1" }))).toBe(true);
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-other" }))).toBe(false);
  });

  it("AnalyticsPI scoping: OIDC PI with empty myPiProjects (claim path) cannot read AnalyticsPI", () => {
    // A3 carry-over N1 — the claim branch resets myPiProjects to [], so the
    // ability returns false for every project. Guards against regressions
    // where a stale token bleeds across sign-ins.
    const ability = defineAbilityForRole("pi", {
      userId: "u-pi-oidc",
      myPiAllocations: [],
      myPiProjects: [],
    });
    expect(ability.can("read", subject("AnalyticsPI", { projectId: "proj-oidc-1" }))).toBe(false);
  });

  it("researcher can read projects they are a member of and cannot create projects", () => {
    const ability = defineAbilityForRole("user", {
      userId: "researcher@nexus.local",
      myMemberProjects: ["proj-1", "proj-2"],
    });
    expect(ability.can("read", subject("Project", { id: "proj-1" }))).toBe(true);
    expect(ability.can("read", subject("Project", { id: "proj-other" }))).toBe(false);
    expect(ability.can("create", "Project")).toBe(false);
    expect(ability.can("manage", subject("Project", { id: "proj-1" }))).toBe(false);
  });

  it("pi can read own + member projects, create projects, and manage own", () => {
    const ability = defineAbilityForRole("pi", {
      userId: "u-pi",
      myPiAllocations: ["alloc-1"],
      myPiProjects: ["proj-owned"],
      myMemberProjects: ["proj-owned", "proj-member-only"],
    });
    // Own (member rule covers it because PIs are members of their own projects in seed)
    expect(ability.can("read", subject("Project", { id: "proj-owned" }))).toBe(true);
    expect(ability.can("read", subject("Project", { id: "proj-member-only" }))).toBe(true);
    expect(ability.can("read", subject("Project", { id: "proj-stranger" }))).toBe(false);
    expect(ability.can("create", "Project")).toBe(true);
    expect(ability.can("manage", subject("Project", { id: "proj-owned" }))).toBe(true);
    expect(ability.can("manage", subject("Project", { id: "proj-member-only" }))).toBe(false);
  });

  it("admin can manage all projects and all clusters", () => {
    const ability = defineAbilityForRole("admin");
    expect(ability.can("manage", subject("Project", { id: "any-project" }))).toBe(true);
    expect(ability.can("create", "Project")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(true);
  });

  it("researcher can read clusters but cannot manage them (EnableToggle stays disabled)", () => {
    const ability = defineAbilityForRole("user", { userId: "researcher@nexus.local" });
    expect(ability.can("read", "Cluster")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(false);
  });

  it("pi can read clusters but cannot manage them (cluster enablement is admin-only)", () => {
    const ability = defineAbilityForRole("pi", {
      userId: "u-pi",
      myPiAllocations: ["alloc-1"],
      myPiProjects: ["proj-1"],
    });
    expect(ability.can("read", "Cluster")).toBe(true);
    expect(ability.can("manage", "Cluster")).toBe(false);
  });
});
