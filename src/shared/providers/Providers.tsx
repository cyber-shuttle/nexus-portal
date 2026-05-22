"use client";

import { AbilityProvider } from "@/shared/casl/AbilityProvider";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";
import { MswProvider } from "./MswProvider";
import { QueryProvider } from "./QueryProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <MswProvider>
        <QueryProvider>
          <AbilityProvider>
            <TooltipProvider>
              {children}
              <Toaster position="top-right" richColors />
            </TooltipProvider>
          </AbilityProvider>
        </QueryProvider>
      </MswProvider>
    </SessionProvider>
  );
}
