import { Button } from "@/shared/ui/button";
import { Headset } from "lucide-react";

export function NeedHelpCard() {
  return (
    <div className="mx-4 mb-4 rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-background">
        <Headset className="h-5 w-5 stroke-[1.75]" />
      </div>
      <div className="mt-3 text-sm font-semibold">Need Help?</div>
      <p className="mt-1 text-xs text-muted-foreground">
        Get help in our Help Center or contact support.
      </p>
      <Button className="mt-3 w-full">Get Support</Button>
    </div>
  );
}
