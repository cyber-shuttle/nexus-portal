import { seed } from "@/mocks/seed";

export type PersonaScopes = {
  myPiAllocations: string[];
  myPiProjects: string[];
  // Membership-derived project IDs — projects the user belongs to in any
  // capacity (PI, co-PI, plain member). Drives the `read Project` CASL
  // condition + the `/projects` list scope for researchers.
  myMemberProjects: string[];
  assignedAllocations: string[];
};

export function derivePersonaScopes(userId: string): PersonaScopes {
  const piProjectIds = new Set(
    seed.projects.filter((p) => p.project_pi_id === userId).map((p) => p.id),
  );
  const piMembershipAllocationIds = new Set(
    seed.memberships
      .filter((m) => m.user_id === userId && seed.membershipRoles[m.id] === "pi")
      .map((m) => m.compute_allocation_id),
  );
  const myPiAllocations = Array.from(
    new Set(
      seed.allocations
        .filter((a) => piProjectIds.has(a.project_id) || piMembershipAllocationIds.has(a.id))
        .map((a) => a.id),
    ),
  ).sort();
  // Project-scoped abilities (AnalyticsPI) need the project list separately —
  // an allocation membership PI role is on the allocation, not the project.
  const myPiProjects = Array.from(piProjectIds).sort();

  // Member-scoped project IDs: walk every membership for this user → its
  // allocation → that allocation's project. Includes PI-owned projects (PIs
  // are also members of their own allocations) so the read rule degenerates
  // to "any project I touch" without an extra union at the call site.
  const myAllocationIds = new Set(
    seed.memberships.filter((m) => m.user_id === userId).map((m) => m.compute_allocation_id),
  );
  const myMemberProjects = Array.from(
    new Set(
      seed.allocations
        .filter((a) => myAllocationIds.has(a.id))
        .map((a) => a.project_id),
    ),
  ).sort();

  const assignedAllocations = Array.from(
    new Set(
      seed.memberships
        .filter((m) => m.user_id === userId && seed.membershipRoles[m.id] === "allocation_manager")
        .map((m) => m.compute_allocation_id),
    ),
  ).sort();

  return { myPiAllocations, myPiProjects, myMemberProjects, assignedAllocations };
}
