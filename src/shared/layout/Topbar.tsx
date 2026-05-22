"use client";

import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Separator } from "@/shared/ui/separator";
import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { PersonaSwitcher } from "./PersonaSwitcher";

export function Topbar() {
  const { data: session, status } = useSession();
  const loading = status === "loading";
  const user = session?.user;
  const name = user?.name ?? user?.email ?? "Signed out";
  const email = user?.email ?? "no session";
  const initial = (user?.email ?? name).slice(0, 1).toUpperCase();

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-8">
      <div className="flex items-center gap-4">
        <span className="font-display text-base font-semibold tracking-tight text-foreground">
          {loading ? "Loading..." : "Nexus HPC"}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <PersonaSwitcher />
        <Separator orientation="vertical" className="h-8" />
        <div className="text-right text-xs leading-tight">
          <div className="font-medium text-foreground">{loading ? "..." : name}</div>
          <div className="text-muted-foreground">{email}</div>
        </div>
        <Avatar className="h-9 w-9 border-2 border-nexus-blue-500">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
          className="hidden md:inline-flex"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
