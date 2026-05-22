import { AbilityBuilder, createMongoAbility, type MongoAbility } from "@casl/ability";

export type Role = "guest" | "user" | "pi" | "co_pi" | "allocation_manager" | "admin";

export type AppAbility = MongoAbility;

export type AbilityContext = {
  userId?: string;
  myPiAllocations?: string[];
  assignedAllocations?: string[];
};

export function defineAbilityForRole(role: Role, ctx: AbilityContext = {}): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  if (role === "guest") {
    return build();
  }

  can("read", "Profile");

  if (role === "user" || role === "pi" || role === "co_pi" || role === "allocation_manager") {
    can("read", "Allocation");
    can("read", "Usage");
    can("read", "Certificate");
    can("create", "ChangeRequest");
  }

  if (role === "pi" || role === "co_pi") {
    can("manage", "Membership", {
      allocationId: { $in: ctx.myPiAllocations ?? [] },
    });
    can("create", "Proposal");
  }

  if (role === "allocation_manager") {
    can("approve", "ChangeRequest", {
      allocationId: { $in: ctx.assignedAllocations ?? [] },
    });
    can("read", "Membership");
  }

  if (role === "admin") {
    can("manage", "all");
  }

  return build();
}
