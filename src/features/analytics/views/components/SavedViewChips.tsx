"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck, MoreHorizontal, Trash2 } from "lucide-react";
import * as React from "react";
import type { SavedView } from "../types";

const VISIBLE_CHIP_LIMIT = 5;

export type SavedViewChipsProps = {
  views: SavedView[];
  activeId?: string | null;
  onApply: (view: SavedView) => void;
  onDelete: (view: SavedView) => void;
  onSetDefault: (view: SavedView) => void;
  className?: string;
};

// Inline chip strip beside the date picker (spec §9 Phase A4). Each chip
// applies a saved view; the trailing kebab opens delete + set-default.
// Long-press / context menu was considered (per spec text) but a visible
// kebab is more discoverable on touch + desktop and matches the existing
// dropdown vocabulary used elsewhere in the portal.
export function SavedViewChips({
  views,
  activeId,
  onApply,
  onDelete,
  onSetDefault,
  className,
}: SavedViewChipsProps) {
  if (views.length === 0) return null;
  const visible = views.slice(0, VISIBLE_CHIP_LIMIT);

  return (
    // `<fieldset>` per biome's a11y/useSemanticElements; behaves like a
    // group landmark for the chip strip without the form-field affordances.
    <fieldset
      aria-label="Saved views"
      className={cn("flex flex-wrap items-center gap-1 border-0 p-0", className)}
      data-testid="analytics-saved-view-chips"
    >
      {visible.map((view) => {
        const isActive = view.id === activeId;
        const Icon = view.is_default ? BookmarkCheck : Bookmark;
        return (
          <div
            key={view.id}
            className="flex items-center rounded-md border border-border bg-card"
            data-testid={`saved-view-chip-${view.id}`}
          >
            <button
              type="button"
              onClick={() => onApply(view)}
              aria-pressed={isActive}
              className={cn(
                "flex items-center gap-1 rounded-l-md px-2 py-1 text-xs font-medium transition-colors",
                "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "bg-accent text-foreground" : "text-muted-foreground",
              )}
            >
              <Icon aria-hidden="true" className="h-3 w-3" />
              <span className="max-w-[10rem] truncate">{view.name}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={(triggerProps) => (
                  <button
                    {...triggerProps}
                    type="button"
                    aria-label={`More actions for ${view.name}`}
                    data-testid={`saved-view-chip-${view.id}-menu`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-r-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal aria-hidden="true" className="h-3 w-3" />
                  </button>
                )}
              />
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => onSetDefault(view)}
                  data-testid={`saved-view-chip-${view.id}-set-default`}
                >
                  <BookmarkCheck aria-hidden="true" className="h-4 w-4" />
                  {view.is_default ? "Default for this persona" : "Set as default"}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(view)}
                  variant="destructive"
                  data-testid={`saved-view-chip-${view.id}-delete`}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      })}
    </fieldset>
  );
}
