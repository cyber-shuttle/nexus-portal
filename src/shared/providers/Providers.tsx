"use client";

import type { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { AbilityProvider } from "@/shared/casl/AbilityProvider";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { Toaster } from "@/shared/ui/sonner";
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
