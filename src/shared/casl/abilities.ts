import { AbilityBuilder, type MongoAbility, createMongoAbility } from "@casl/ability";
import type { Session } from "next-auth";

export type Role = "guest" | "user" | "pi" | "co_pi" | "allocation_manager";
export type SystemRole = "admin";

export type AppAbility = MongoAbility;

export type AbilityContext = {
  userId?: string;
  myPiAllocations?: string[];
  myPiProjects?: string[];
  // Membership-derived project IDs — every project where the user is a
  // member (PI, co-PI, or plain). Researchers see only this slice; PIs see
  // their own + member projects; admins see everything via `manage all`.
  myMemberProjects?: string[];
  assignedAllocations?: string[];
};

type Can = AbilityBuilder<AppAbility>["can"];
type Cannot = AbilityBuilder<AppAbility>["cannot"];

export function defineAbility(session: Session | null | undefined): AppAbility {
  const builder = new AbilityBuilder<AppAbility>(createMongoAbility);

  const role = session?.user?.role ?? "guest";
  applyAllocationRules(builder.can, builder.cannot, role, {
    userId: session?.user?.id,
    myPiAllocations: session?.user?.myPiAllocations,
    myPiProjects: session?.user?.myPiProjects,
    myMemberProjects: session?.user?.myMemberProjects,
    assignedAllocations: session?.user?.assignedAllocations,
  });

  if (session?.systemRole === "admin") {
    applyAdminRules(builder.can, builder.cannot);
  }

  return builder.build();
}

function applyAllocationRules(can: Can, _cannot: Cannot, role: Role, ctx: AbilityContext): void {
  if (role === "guest") return;

  can("read", "Profile");

  if (role === "user" || role === "pi" || role === "co_pi" || role === "allocation_manager") {
    can("read", "Allocation");
    can("read", "Usage");
    can("read", "Certificate", { username: ctx.userId ?? "__none__" });
    can("read", "Client", { owner_user_id: ctx.userId ?? "__none__" });
    can("manage", "Client", { owner_user_id: ctx.userId ?? "__none__" });
    can("create", "ChangeRequest");
    can("read", "AnalyticsResearcher", { userId: ctx.userId ?? "__none__" });
    // Project read is membership-scoped for every signed-in persona — admin
    // overrides via `manage all` (system axis), PI extends with `manage Project`
    // on owned rows. Researchers see only projects they belong to.
    can("read", "Project", { id: { $in: ctx.myMemberProjects ?? [] } });
    // Cluster read is universal (every persona enumerates clusters in their
    // allocation forms); cluster `manage` is admin-only (system axis).
    can("read", "Cluster");
  }

  if (role === "pi" || role === "co_pi") {
    can("manage", "Membership", {
      allocationId: { $in: ctx.myPiAllocations ?? [] },
    });
    can("approve", "ChangeRequest", {
      allocationId: { $in: ctx.myPiAllocations ?? [] },
    });
    can("create", "Proposal");
    can("read", "Proposal", { requester_id: ctx.userId ?? "__none__" });
    can("transfer", "Allocation", {
      id: { $in: ctx.myPiAllocations ?? [] },
    });
    can("read", "Client", { allocation_id: { $in: ctx.myPiAllocations ?? [] } });
    can("create", "Client");
    can("manage", "Client", { allocation_id: { $in: ctx.myPiAllocations ?? [] } });
    can("read", "AnalyticsPI", { projectId: { $in: ctx.myPiProjects ?? [] } });
    // Project create + own-project manage. PIs may create new projects and
    // edit/delete projects where they are the recorded PI. `myPiProjects`
    // already collects "projects where I am PI" from the persona scopes.
    can("create", "Project");
    can("manage", "Project", { id: { $in: ctx.myPiProjects ?? [] } });
  }

  if (role === "allocation_manager") {
    can("approve", "ChangeRequest", {
      allocationId: { $in: ctx.assignedAllocations ?? [] },
    });
    can("manage", "Membership", {
      allocationId: { $in: ctx.assignedAllocations ?? [] },
    });
    can("read", "Membership");
  }
}

function applyAdminRules(can: Can, _cannot: Cannot): void {
  can("manage", "all");
  // Explicit so the rule is greppable; `manage all` already covers it.
  can("manage", "Analytics");
  // Same rationale for Project + Cluster — kept explicit so anyone
  // grepping the codebase finds the admin grants alongside the persona
  // ones in the same module.
  can("manage", "Project");
  can("create", "Project");
  can("manage", "Cluster");
  can("read", "Trace");
  can("retry", "Trace");
}
