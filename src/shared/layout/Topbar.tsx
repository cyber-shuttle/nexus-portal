"use client";

import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Bell, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Breadcrumbs } from "./Breadcrumbs";
import { UserPill } from "./UserPill";

function NavArrows() {
  const router = useRouter();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Go back"
        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        onClick={() => router.back()}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Go forward"
        className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
        onClick={() => router.forward()}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function NotificationBell() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon"
            aria-label="Notifications"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
          </Button>
        )}
      />
      <TooltipContent>Notifications</TooltipContent>
    </Tooltip>
  );
}

export function Topbar() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-8">
      <div className="flex items-center gap-4">
        <NavArrows />
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-4">
        <NotificationBell />
        <UserPill />
      </div>
    </header>
  );
}
