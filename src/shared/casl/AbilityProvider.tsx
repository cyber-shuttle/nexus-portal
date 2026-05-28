"use client";

import { AbilityProvider as CaslAbilityProvider, useAbility as useCaslAbility } from "@casl/react";
import { useSession } from "next-auth/react";
import { type ReactNode, useMemo } from "react";
import { type AppAbility, defineAbility } from "./abilities";

export function AbilityProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  const ability = useMemo(
    () => defineAbility(session),
    // Re-derive whenever any axis input shifts. session identity is stable per
    // NextAuth refresh, so this list captures all real changes.
    [
      session,
    ],
  );

  return <CaslAbilityProvider value={ability}>{children}</CaslAbilityProvider>;
}

export function useAbility(): AppAbility {
  return useCaslAbility() as AppAbility;
}
