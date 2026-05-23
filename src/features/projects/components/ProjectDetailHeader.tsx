"use client";

import { formatDate } from "@/lib/format";
import { MetaItem, MetaRow } from "@/shared/ui/MetaRow";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Building2, Calendar, UserSquare } from "lucide-react";
import * as React from "react";
import type { Project } from "../schemas";

export type ProjectDetailHeaderProps = {
  project: Project;
  piName: string | null;
  organizationName: string | null;
  // Gating decision lives in the container — we just take the boolean.
  canAddAllocation: boolean;
};

export function ProjectDetailHeader({
  project,
  piName,
  organizationName,
  canAddAllocation,
}: ProjectDetailHeaderProps) {
  const statusTone: "success" | "warning" | "danger" =
    project.status === "ACTIVE" ? "success" : project.status === "INACTIVE" ? "warning" : "danger";

  // Placeholder dialog state — the real allocation-creation form lands in a
  // future phase, so we surface intent (and exercise the CASL gate) without
  // shipping a half-built mutation.
  const [open, setOpen] = React.useState(false);

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">
          {project.title}
        </h1>
        {canAddAllocation ? (
          <Button onClick={() => setOpen(true)} aria-label="Add allocation">
            + Add allocation
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-disabled
                  aria-label="Add allocation (no permission)"
                  className="opacity-50 cursor-not-allowed"
                  onClick={(e) => e.preventDefault()}
                >
                  + Add allocation
                </Button>
              }
            />
            <TooltipContent>You don't have permission to add allocations</TooltipContent>
          </Tooltip>
        )}
      </div>
      <MetaRow>
        <MetaItem variant="status" tone={statusTone} value={project.status} />
        <MetaItem icon={UserSquare} label="PI" value={piName ?? project.project_pi_id} />
        <MetaItem
          icon={Building2}
          label="Origination"
          value={organizationName ?? project.origination}
        />
        <MetaItem icon={Calendar} label="Created" value={formatDate(project.created_time)} />
      </MetaRow>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add allocation</DialogTitle>
            <DialogDescription>
              Allocation creation form lands in a future phase.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </header>
  );
}
