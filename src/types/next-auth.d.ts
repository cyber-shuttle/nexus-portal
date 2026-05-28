import "next-auth";
import "next-auth/jwt";
import type { Role, SystemRole } from "@/shared/casl/abilities";

type AuthProviderKind = "github" | "oidc" | "credentials";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    provider?: AuthProviderKind;
    systemRole?: SystemRole | null;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: Role;
      personId?: string;
      myPiAllocations?: string[];
      myPiProjects?: string[];
      myMemberProjects?: string[];
      assignedAllocations?: string[];
    };
  }

  interface User {
    role?: Role;
    systemRole?: SystemRole | null;
    personId?: string;
    myPiAllocations?: string[];
    myPiProjects?: string[];
    myMemberProjects?: string[];
    assignedAllocations?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    provider?: AuthProviderKind;
    systemRole?: SystemRole | null;
    role?: Role;
    personId?: string;
    myPiAllocations?: string[];
    myPiProjects?: string[];
    myMemberProjects?: string[];
    assignedAllocations?: string[];
  }
}
