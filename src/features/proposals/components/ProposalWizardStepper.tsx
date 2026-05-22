"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProposalWizardStep = {
  id: string;
  label: string;
  description?: string;
};

export type ProposalWizardStepperProps = {
  steps: ProposalWizardStep[];
  currentIndex: number;
  completedIndices: Set<number>;
  onSelect: (index: number) => void;
};

export function ProposalWizardStepper({
  steps,
  currentIndex,
  completedIndices,
  onSelect,
}: ProposalWizardStepperProps) {
  return (
    <nav aria-label="Proposal wizard steps" className="space-y-1">
      <ol className="space-y-1">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isCompleted = completedIndices.has(index);
          const canSelect = isCompleted || index <= currentIndex;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!canSelect}
                onClick={() => canSelect && onSelect(index)}
                aria-current={isCurrent ? "step" : undefined}
                className={cn(
                  "group flex w-full items-start gap-3 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors",
                  isCurrent
                    ? "border-border bg-muted/40"
                    : "hover:bg-muted/20",
                  !canSelect && "cursor-not-allowed opacity-60",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                    isCurrent
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {isCompleted ? <CheckIcon className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className="space-y-0.5">
                  <span className="block font-medium leading-tight">{step.label}</span>
                  {step.description ? (
                    <span className="block text-xs text-muted-foreground">
                      {step.description}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
