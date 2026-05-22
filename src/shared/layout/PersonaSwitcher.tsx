"use client";

import { Button } from "@/shared/ui/button";
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

export function PersonaSwitcher() {
  const { data: session } = useSession();

  const authMode = process.env.NEXT_PUBLIC_PORTAL_AUTH_MODE ?? "dev";
  if (authMode !== "dev") return null;

  const switchTo = async (email: string) => {
    await signOut({ redirect: false });
    await signIn("credentials", { email, password: "dev", callbackUrl: "/home" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button {...props} variant="outline" size="sm" className="gap-2">
            <UserCog className="h-4 w-4" />
            <span className="hidden md:inline">Switch persona</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end" className="w-64">
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
  );
}
