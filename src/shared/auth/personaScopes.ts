import { seed } from "@/mocks/seed";

export type PersonaScopes = {
  myPiAllocations: string[];
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
        .filter(
          (a) => piProjectIds.has(a.project_id) || piMembershipAllocationIds.has(a.id),
        )
        .map((a) => a.id),
    ),
  ).sort();

  const assignedAllocations = Array.from(
    new Set(
      seed.memberships
        .filter(
          (m) =>
            m.user_id === userId &&
            seed.membershipRoles[m.id] === "allocation_manager",
        )
        .map((m) => m.compute_allocation_id),
    ),
  ).sort();

  return { myPiAllocations, assignedAllocations };
}
