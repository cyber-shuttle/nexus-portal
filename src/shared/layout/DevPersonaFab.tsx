"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { UserCog } from "lucide-react";
import { signIn, signOut, useSession } from "next-auth/react";

const personas = [
  { id: "researcher", email: "researcher@nexus.local", label: "Researcher" },
  { id: "pi", email: "pi@nexus.local", label: "Principal Investigator" },
  { id: "admin", email: "admin@nexus.local", label: "Site Admin" },
];

export function DevPersonaFab() {
  const { data: session } = useSession();

  // Dev-only affordance — the production-look topbar deliberately omits this.
  const authMode = process.env.NEXT_PUBLIC_PORTAL_AUTH_MODE ?? "dev";
  if (authMode !== "dev") return null;

  const switchTo = async (email: string) => {
    await signOut({ redirect: false });
    await signIn("credentials", { email, password: "dev", callbackUrl: "/home" });
  };

  return (
    <div className="fixed right-4 bottom-4 z-50">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={(props) => (
            <button
              {...props}
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-xs font-semibold tracking-wide text-background shadow-md outline-none hover:bg-foreground/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <UserCog className="h-4 w-4" />
              DEV
            </button>
          )}
        />
        <DropdownMenuContent align="end" side="top" className="w-64">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Dev personas</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {personas.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onSelect={() => void switchTo(p.email)}
                disabled={session?.user?.email === p.email}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className="text-xs text-muted-foreground">{p.email}</span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
