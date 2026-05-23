"use client";

import { formatDate } from "@/lib/format";
import { MetaItem, MetaRow } from "@/shared/ui/MetaRow";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Building2, Calendar, UserSquare } from "lucide-react";
import type { Project } from "../schemas";

export type ProjectDetailHeaderProps = {
  project: Project;
  piName: string | null;
  organizationName: string | null;
  // Gating decision lives in the container — we just take the boolean.
  canAddAllocation: boolean;
  onAddAllocation?: () => void;
};

export function ProjectDetailHeader({
  project,
  piName,
  organizationName,
  canAddAllocation,
  onAddAllocation,
}: ProjectDetailHeaderProps) {
  const statusTone: "success" | "warning" | "danger" =
    project.status === "ACTIVE" ? "success" : project.status === "INACTIVE" ? "warning" : "danger";

  return (
    <header className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">
          {project.title}
        </h1>
        {canAddAllocation ? (
          // Add-allocation route doesn't exist yet — disable the CTA with a
          // tooltip rather than hiding it so PIs/admins see the affordance.
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  aria-disabled
                  aria-label="Add allocation (lands in a future phase)"
                  className="opacity-50 cursor-not-allowed"
                  onClick={(e) => {
                    e.preventDefault();
                    onAddAllocation?.();
                  }}
                >
                  + Add allocation
                </Button>
              }
            />
            <TooltipContent>Allocation creation lands in a future phase</TooltipContent>
          </Tooltip>
        ) : null}
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
    </header>
  );
}
