// Backend ComputeAllocationMembership has no role column today; this enum is the
// contract we'll publish via docs/backend-contracts/memberships.md and persist
// portal-side (MSW seed) until the column lands. See gap doc for the migration plan.
export const MEMBERSHIP_ROLES = ["pi", "co_pi", "allocation_manager", "user"] as const;

export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

export const MEMBERSHIP_ROLE_LABELS: Record<MembershipRole, string> = {
  pi: "PI",
  co_pi: "Co-PI",
  allocation_manager: "Allocation Manager",
  user: "User",
};
