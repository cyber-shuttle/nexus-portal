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
});
