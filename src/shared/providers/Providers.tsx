"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AbilityProvider } from "@/shared/casl/AbilityProvider";
import { MswProvider } from "./MswProvider";
import { QueryProvider } from "./QueryProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <MswProvider>
        <QueryProvider>
          <AbilityProvider>{children}</AbilityProvider>
        </QueryProvider>
      </MswProvider>
    </SessionProvider>
  );
}
