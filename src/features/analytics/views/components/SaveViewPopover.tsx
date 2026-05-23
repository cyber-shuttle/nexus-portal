"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Bookmark } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import type { CreateSavedViewPayload } from "../types";
import { SAVED_VIEW_LIMIT_PER_PERSONA } from "../types";

const NAME_MAX = 80;

export type SaveViewPopoverProps = {
  // Current URL state captured at submit-time; the popover only owns the
  // name + is_default form fields. The container builds the persona / range /
  // group_by halves of the payload from URL state.
  buildPayload: (form: { name: string; is_default: boolean }) => CreateSavedViewPayload;
  onCreate: (payload: CreateSavedViewPayload) => Promise<unknown> | unknown;
  currentCount: number;
  disabled?: boolean;
  isSaving?: boolean;
  // External error message (e.g. server-side name conflict) surfaced on the
  // popover form. Cleared when the popover closes.
  errorMessage?: string | null;
  className?: string;
};

export function SaveViewPopover({
  buildPayload,
  onCreate,
  currentCount,
  disabled = false,
  isSaving = false,
  errorMessage,
  className,
}: SaveViewPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [isDefault, setIsDefault] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  // Reset local form state whenever the popover opens so the user starts
  // from a clean draft. We don't autosave a previous draft — saved views
  // are cheap to recreate.
  React.useEffect(() => {
    if (open) {
      setName("");
      setIsDefault(false);
      setLocalError(null);
    }
  }, [open]);

  const atLimit = currentCount >= SAVED_VIEW_LIMIT_PER_PERSONA;
  // Allow the trigger to open even when at-limit so the user sees the
  // cap message — disabling the submit button is what gates creation.
  const triggerDisabled = disabled;

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !atLimit && !isSaving;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;
    setLocalError(null);
    try {
      await onCreate(buildPayload({ name: trimmed, is_default: isDefault }));
      setOpen(false);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to save view");
    }
  };

  const visibleError = localError ?? errorMessage ?? null;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={className}
            disabled={triggerDisabled}
            data-testid="analytics-save-view-trigger"
          >
            <Bookmark aria-hidden="true" className="h-3.5 w-3.5 stroke-[1.5]" />
            <span>+ Save view</span>
          </Button>
        }
      />
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner sideOffset={4} className="z-50 outline-none">
          <PopoverPrimitive.Popup
            className={cn(
              "z-50 w-80 rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10",
              "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
            )}
          >
            <form
              className="space-y-3"
              onSubmit={handleSubmit}
              data-testid="analytics-save-view-form"
              aria-label="Save current view"
            >
              <div className="space-y-1.5">
                <Label htmlFor="save-view-name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="save-view-name"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  maxLength={NAME_MAX}
                  autoFocus
                  placeholder="e.g. Weekly review"
                  data-testid="analytics-save-view-name"
                  aria-invalid={visibleError ? true : undefined}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.currentTarget.checked)}
                  className="h-4 w-4 rounded border-border text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="analytics-save-view-default"
                />
                Use as default for this persona
              </label>
              {atLimit ? (
                <p className="text-xs text-destructive" data-testid="analytics-save-view-limit">
                  You're at the {SAVED_VIEW_LIMIT_PER_PERSONA}-view limit. Delete one
                  to save a new view.
                </p>
              ) : null}
              {visibleError ? (
                <p className="text-xs text-destructive" data-testid="analytics-save-view-error">
                  {visibleError}
                </p>
              ) : null}
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={!canSubmit}
                  data-testid="analytics-save-view-submit"
                >
                  {isSaving ? "Saving…" : "Save view"}
                </Button>
              </div>
            </form>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
