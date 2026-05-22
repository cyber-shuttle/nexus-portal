"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { useAbility } from "@shared/casl/AbilityProvider";
import type * as React from "react";

export function AmiePermissionGate({ children }: { children: React.ReactNode }) {
  const ability = useAbility();
  if (!ability.can("read", "AmiePacket") && !ability.can("manage", "AmiePacket")) {
    return <ErrorState message="Not permitted." />;
  }
  return <>{children}</>;
}
