"use client";

import { AbilityProvider } from "@/shared/casl/AbilityProvider";
import { Toaster } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { MswProvider } from "./MswProvider";
import { QueryProvider } from "./QueryProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="nexus.theme"
        disableTransitionOnChange
      >
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
      </ThemeProvider>
    </SessionProvider>
  );
}
