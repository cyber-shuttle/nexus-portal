"use client";

import { useFeedback } from "@/features/feedback/FeedbackProvider";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Headset, MessageSquarePlus } from "lucide-react";
import { useSession } from "next-auth/react";

// Placeholder until a real support flow exists. mailto keeps the button
// interactive so it's not a WCAG-fail "control with no behavior".
const SUPPORT_MAILTO = "mailto:support@nexus.local?subject=Nexus%20Portal%20Help";

export function NeedHelpCard() {
  const { status } = useSession();
  const { openMode, isCapturing } = useFeedback();
  const signedIn = status === "authenticated";
  const disabled = !signedIn || isCapturing;

  const suggestionButton = (
    <Button
      variant="outline"
      className="mt-2 w-full"
      onClick={() => void openMode()}
      disabled={disabled}
      data-feedback-ignore
    >
      <MessageSquarePlus className="mr-2 h-4 w-4" />
      Suggestion mode
    </Button>
  );

  return (
    <div className="mx-4 mb-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
        <Headset className="h-5 w-5 stroke-[1.75]" />
      </div>
      <div className="mt-3 text-sm font-semibold">Need Help?</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Get help in our Help Center or contact support.
      </p>
      <Button
        className="mt-3 w-full"
        onClick={() => {
          window.location.href = SUPPORT_MAILTO;
        }}
      >
        Get Support
      </Button>
      {signedIn ? (
        suggestionButton
      ) : (
        <Tooltip>
          <TooltipTrigger render={(props) => <div {...props}>{suggestionButton}</div>} />
          <TooltipContent>Sign in to send feedback</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
