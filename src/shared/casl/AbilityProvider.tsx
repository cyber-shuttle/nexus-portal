"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import { defineAbilityForRole, type AppAbility } from "./abilities";

const AbilityContext = createContext<AppAbility | null>(null);

export function AbilityProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const role = session?.user?.role ?? "guest";

  const ability = useMemo(
    () => defineAbilityForRole(role, { userId: session?.user?.id }),
    [role, session?.user?.id],
  );

  return <AbilityContext.Provider value={ability}>{children}</AbilityContext.Provider>;
}

export function useAbility(): AppAbility {
  const ability = useContext(AbilityContext);
  if (!ability) {
    return defineAbilityForRole("guest");
  }
  return ability;
}
