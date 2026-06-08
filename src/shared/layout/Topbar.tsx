"use client";

import { useFeedback } from "@/features/feedback/FeedbackProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Headset,
  MessageSquarePlus,
  Settings,
} from "lucide-react";
import { useSession } from "next-auth/react";

import { useRouter } from "next/navigation";
import { Breadcrumbs } from "./Breadcrumbs";
import { UserPill } from "./UserPill";
import { useNavHistory } from "./useNavHistory";

const SUPPORT_MAILTO =
  "mailto:support@nexus.local?subject=Nexus%20Portal%20Help";

function NavArrows() {
  const router = useRouter();
  const { canGoBack, canGoForward } = useNavHistory();
  const baseClass =
    "h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground";
  const disabledClass = "opacity-50 cursor-not-allowed";
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Go back"
        disabled={!canGoBack}
        className={cn(baseClass, !canGoBack && disabledClass)}
        onClick={() => router.back()}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Go forward"
        disabled={!canGoForward}
        className={cn(baseClass, !canGoForward && disabledClass)}
        onClick={() => router.forward()}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function HelpMenu() {
  const { status } = useSession();
  const { openMode, isCapturing } = useFeedback();
  const signedIn = status === "authenticated";
  const suggestionDisabled = !signedIn || isCapturing;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Help"
            title="Help"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => {
            window.location.href = SUPPORT_MAILTO;
          }}
        >
          <Headset className="mr-2 h-4 w-4" />
          Get support
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={suggestionDisabled}
          onClick={() => {
            if (!suggestionDisabled) void openMode();
          }}
          data-feedback-ignore
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Suggestion mode
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SettingsButton() {
  return (
    <Tooltip>
      <TooltipTrigger
        render={(props) => (
          <Button
            {...props}
            variant="ghost"
            size="icon"
            aria-label="Settings"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={() => { window.location.href = "/settings"; }}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      />
      <TooltipContent>Settings</TooltipContent>
    </Tooltip>
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
        <div className="flex items-center gap-1">
          <HelpMenu />
          <NotificationBell />
          <SettingsButton />
        </div>
        <UserPill />
      </div>
    </header>
  );
}
