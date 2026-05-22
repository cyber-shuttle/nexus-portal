"use client";

import { useMemo, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { AbilityProvider as CaslAbilityProvider, useAbility as useCaslAbility } from "@casl/react";
import { defineAbilityForRole, type AppAbility } from "./abilities";

export function AbilityProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "guest";

  const ability = useMemo(
    () =>
      defineAbilityForRole(role, {
        userId: session?.user?.id,
        myPiAllocations: session?.user?.myPiAllocations,
        assignedAllocations: session?.user?.assignedAllocations,
      }),
    [
      role,
      session?.user?.id,
      session?.user?.myPiAllocations,
      session?.user?.assignedAllocations,
    ],
  );

  return <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>;
}

export function useAbility(): AppAbility {
  return useCaslAbility() as AppAbility;
}
