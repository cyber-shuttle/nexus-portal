"use client";

import { cn } from "@/lib/utils";
import type { AllocationStatus } from "../schemas";

export type StatusFilterProps = {
  value: AllocationStatus[];
  onChange: (next: AllocationStatus[]) => void;
};

const STATUSES: AllocationStatus[] = ["ACTIVE", "INACTIVE", "DELETED"];

export function AllocationStatusFilter({ value, onChange }: StatusFilterProps) {
  const toggle = (status: AllocationStatus) => {
    const next = value.includes(status) ? value.filter((s) => s !== status) : [...value, status];
    onChange(next);
  };
  return (
    <fieldset className="flex flex-wrap items-center gap-2 border-0 p-0">
      <legend className="mr-2 text-xs uppercase tracking-wide text-muted-foreground">
        Status
      </legend>
      {STATUSES.map((status) => {
        const active = value.includes(status);
        return (
          <button
            key={status}
            type="button"
            onClick={() => toggle(status)}
            aria-pressed={active}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "border-[color:var(--nexus-blue-500)] bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {status}
          </button>
        );
      })}
    </fieldset>
  );
}
