"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { useAbility } from "@shared/casl/AbilityProvider";
import type * as React from "react";

export function TracePermissionGate({ children }: { children: React.ReactNode }) {
  const ability = useAbility();
  if (ability.cannot("read", "Trace")) {
    return <ErrorState message="Not permitted." />;
  }
  return <>{children}</>;
}
