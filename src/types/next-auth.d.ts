import "next-auth";
import "next-auth/jwt";
import type { Role } from "@/shared/casl/abilities";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: Role;
      personId?: string;
      myPiAllocations?: string[];
      assignedAllocations?: string[];
    };
  }

  interface User {
    role?: Role;
    personId?: string;
    myPiAllocations?: string[];
    assignedAllocations?: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    role?: Role;
    personId?: string;
    myPiAllocations?: string[];
    assignedAllocations?: string[];
  }
}
