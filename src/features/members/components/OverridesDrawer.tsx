"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError } from "@shared/api/client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import {
  useCreateMembershipOverride,
  useDeleteMembershipOverride,
  useMembershipOverrides,
  useUpdateMembershipOverride,
} from "../queries";

export type OverridesDrawerResource = {
  id: string;
  name: string;
};

export type OverridesDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  memberLabel: string;
  resources: OverridesDrawerResource[];
};

export function OverridesDrawer({
  open,
  onOpenChange,
  membershipId,
  memberLabel,
  resources,
}: OverridesDrawerProps) {
  const overridesQuery = useMembershipOverrides(open ? membershipId : undefined);
  const overrides = overridesQuery.data ?? [];
  const createMutation = useCreateMembershipOverride();
  const updateMutation = useUpdateMembershipOverride();
  const deleteMutation = useDeleteMembershipOverride();

  const [draft, setDraft] = React.useState<{
    resourceId: string;
    amount: string;
    time: string;
  }>({ resourceId: resources[0]?.id ?? "", amount: "", time: "" });

  React.useEffect(() => {
    if (open && !draft.resourceId && resources[0]?.id) {
      setDraft((prev) => ({ ...prev, resourceId: resources[0]?.id ?? "" }));
    }
  }, [open, resources, draft.resourceId]);

  async function onCreate() {
    if (!draft.resourceId || !draft.amount || !draft.time) {
      toast.error("Pick a resource and provide amount + time.");
      return;
    }
    try {
      await createMutation.mutateAsync({
        compute_allocation_membership_id: membershipId,
        compute_allocation_resource_id: draft.resourceId,
        override_resource_amount: Number(draft.amount),
        override_resource_time: Number(draft.time),
      });
      toast.success("Override added");
      setDraft({ resourceId: resources[0]?.id ?? "", amount: "", time: "" });
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Failed";
      toast.error(msg);
    }
  }

  async function onUpdate(id: string, patch: { amount?: number; time?: number }) {
    try {
      await updateMutation.mutateAsync({
        id,
        patch: {
          ...(patch.amount !== undefined ? { override_resource_amount: patch.amount } : {}),
          ...(patch.time !== undefined ? { override_resource_time: patch.time } : {}),
        },
      });
      toast.success("Override updated");
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Failed";
      toast.error(msg);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMutation.mutateAsync({ id, membershipId });
      toast.success("Override removed");
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Failed";
      toast.error(msg);
    }
  }

  function resourceName(id: string): string {
    return resources.find((r) => r.id === id)?.name ?? id;
  }

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Resource overrides"
      description={memberLabel}
      width="lg"
    >
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Existing</h3>
          {overridesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : overrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">No overrides set.</p>
          ) : (
            <ul className="space-y-2">
              {overrides.map((o) => (
                <li key={o.id} className="rounded-md border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {resourceName(o.compute_allocation_resource_id)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(o.id)}
                      aria-label={`Delete override ${o.id}`}
                    >
                      Delete
                    </Button>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="space-y-1">
                      <Label htmlFor={`amount-${o.id}`} className="text-xs text-muted-foreground">
                        Amount
                      </Label>
                      <Input
                        id={`amount-${o.id}`}
                        type="number"
                        defaultValue={o.override_resource_amount}
                        onBlur={(e) =>
                          onUpdate(o.id, { amount: Number(e.currentTarget.value) })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`time-${o.id}`} className="text-xs text-muted-foreground">
                        Time (min)
                      </Label>
                      <Input
                        id={`time-${o.id}`}
                        type="number"
                        defaultValue={o.override_resource_time}
                        onBlur={(e) =>
                          onUpdate(o.id, { time: Number(e.currentTarget.value) })
                        }
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-3 rounded-md border bg-muted/30 p-3">
          <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Add override</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="override-resource" className="text-xs text-muted-foreground">
                Resource
              </Label>
              <select
                id="override-resource"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
                value={draft.resourceId}
                onChange={(e) =>
                  setDraft((prev) => ({ ...prev, resourceId: e.currentTarget.value }))
                }
              >
                {resources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="override-amount" className="text-xs text-muted-foreground">
                Amount
              </Label>
              <Input
                id="override-amount"
                type="number"
                min={0}
                value={draft.amount}
                onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.currentTarget.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="override-time" className="text-xs text-muted-foreground">
                Time (min)
              </Label>
              <Input
                id="override-time"
                type="number"
                min={0}
                value={draft.time}
                onChange={(e) => setDraft((prev) => ({ ...prev, time: e.currentTarget.value }))}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={onCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Adding…" : "Add override"}
            </Button>
          </div>
        </section>
      </div>
    </SideDrawer>
  );
}
