"use client";

import { ChevronRight } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import { SideDrawer, type SideDrawerWidth } from "@/shared/ui/SideDrawer";

export type DrillCrumb = {
  label: string;
  onPop: () => void;
};

export type DrillStackProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  crumbs: DrillCrumb[];
  children: React.ReactNode;
  width?: SideDrawerWidth;
};

// `DrillStack` wraps SideDrawer to add a breadcrumb row above the title so
// chart-segment drilldowns retain context across levels (spec §7.7).
export function DrillStack({
  open,
  onClose,
  title,
  crumbs,
  children,
  width = "lg",
}: DrillStackProps) {
  // Render crumbs above the title slot. SideDrawer already owns the title,
  // so we push the crumbs into the title node and keep `title` as the head.
  const header = (
    <div className="space-y-2">
      {crumbs.length > 0 ? (
        <nav
          aria-label="Drill breadcrumb"
          className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
        >
          {crumbs.map((crumb, i) => (
            <React.Fragment key={`${crumb.label}-${i}`}>
              <Button
                variant="ghost"
                size="xs"
                onClick={crumb.onPop}
                className="h-6 px-1.5 text-xs"
              >
                {crumb.label}
              </Button>
              <ChevronRight aria-hidden="true" className="h-3 w-3 stroke-[1.5]" />
            </React.Fragment>
          ))}
        </nav>
      ) : null}
      <span className={cn("font-display text-lg font-semibold text-foreground")}>{title}</span>
    </div>
  );

  return (
    <SideDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={header}
      width={width}
    >
      {children}
    </SideDrawer>
  );
}
