"use client";

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ErrorState } from "@/shared/ui/ErrorState";
import { Spinner } from "@/shared/ui/Loading";

export type EnableToggleResource = {
  kind: "cluster" | "resource";
  id: string;
  label: string;
};

export type EnableToggleImpact = {
  activeAllocations: number;
  activeUsers: number;
  inflightJobs?: number;
};

export type EnableToggleProps = {
  enabled: boolean;
  resource: EnableToggleResource;
  impact?: EnableToggleImpact;
  onConfirm: (next: boolean) => Promise<void>;
  disabled?: boolean;
  size?: "sm" | "md";
};

const sizeClasses = {
  sm: "h-4 w-7",
  md: "h-5 w-9",
} as const;

const thumbSizeClasses = {
  sm: "size-3",
  md: "size-4",
} as const;

// EnableToggle drives an admin-only "is this cluster/resource available" switch.
// The click never flips state directly — it opens a confirmation Dialog that
// surfaces the blast radius (active allocations + users + optional in-flight
// jobs) and only invokes `onConfirm` after the admin confirms. We never use a
// red palette because "disabled" is a deliberate operational state, not an
// error condition. Visual contract: enabled = brand-tint background + green
// dot, disabled = muted background + gray dot.
export function EnableToggle({
  enabled,
  resource,
  impact,
  onConfirm,
  disabled = false,
  size = "md",
}: EnableToggleProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = !enabled;
  const actionLabel = next ? "Enable" : "Disable";
  // Dialog button + error heading echo the kind (e.g. "Disable cluster") so
  // the admin sees what they're acting on without re-reading the title (TF2
  // QA copy nit).
  const actionLabelWithKind = `${actionLabel} ${resource.kind}`;
  const stateLabel = enabled ? "Enabled" : "Disabled";

  async function handleConfirm() {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(next);
      toast.success(`${resource.label} ${next ? "enabled" : "disabled"}`);
      setOpen(false);
    } catch (err) {
      // Surface the underlying message but never the full Error object — the
      // Dialog body should remain copy-friendly for admins.
      const message = err instanceof Error ? err.message : "Could not update status";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={
          disabled
            ? `${resource.label} status: ${stateLabel} (read-only)`
            : `${stateLabel}: click to ${actionLabel.toLowerCase()} ${resource.label}`
        }
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-2 py-1 text-xs font-medium transition-colors",
          enabled
            ? "bg-brand-tint text-foreground"
            : "bg-muted text-muted-foreground",
          disabled && "cursor-not-allowed opacity-60",
        )}
        data-state={enabled ? "enabled" : "disabled"}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            enabled
              ? "bg-[color:var(--nexus-green-500)]"
              : "bg-muted-foreground/60",
          )}
        />
        {stateLabel}
        <span
          aria-hidden="true"
          className={cn(
            "relative inline-flex items-center rounded-full bg-foreground/15",
            sizeClasses[size],
          )}
        >
          <span
            className={cn(
              "absolute rounded-full bg-background shadow-sm transition-transform",
              thumbSizeClasses[size],
              enabled ? "translate-x-[calc(100%-2px)]" : "translate-x-[2px]",
            )}
          />
        </span>
      </button>

      <Dialog open={open} onOpenChange={(o) => (submitting ? null : setOpen(o))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionLabel} {resource.label}?
            </DialogTitle>
            <DialogDescription>
              {next
                ? `Re-enabling will allow new allocations to target ${resource.label}.`
                : `Disabling hides ${resource.label} from new allocation flows. Existing allocations and in-flight jobs continue.`}
            </DialogDescription>
          </DialogHeader>

          {impact ? (
            <ul className="grid grid-cols-1 gap-1 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-3">
              <li>
                <span className="block text-xs text-muted-foreground">Active allocations</span>
                <span className="font-medium">{impact.activeAllocations.toLocaleString()}</span>
              </li>
              <li>
                <span className="block text-xs text-muted-foreground">Active users</span>
                <span className="font-medium">{impact.activeUsers.toLocaleString()}</span>
              </li>
              {typeof impact.inflightJobs === "number" ? (
                <li>
                  <span className="block text-xs text-muted-foreground">In-flight jobs</span>
                  <span className="font-medium">{impact.inflightJobs.toLocaleString()}</span>
                </li>
              ) : null}
            </ul>
          ) : null}

          {error ? (
            <ErrorState heading={`Could not ${actionLabelWithKind.toLowerCase()}`} message={error} />
          ) : null}

          {submitting ? (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
              <Spinner />
              <span>Saving…</span>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
              type="button"
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={submitting} type="button">
              {actionLabelWithKind}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Re-export the underlying Base UI Switch for any future inline (non-confirmed)
// use cases. The EnableToggle above intentionally never renders the raw Switch
// — it ships its own pill-style trigger to keep the confirm-flow primitive
// distinct from a casual on/off toggle.
export { SwitchPrimitive };
