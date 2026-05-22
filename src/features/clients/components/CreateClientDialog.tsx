"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ApiError } from "@shared/api/client";
import * as React from "react";
import { toast } from "sonner";
import { useCreateClient } from "../queries";

export type CreateClientDialogProps = {
  trigger: React.ReactElement;
  allocationOptions: { id: string; name: string }[];
  defaultOwnerUserId: string;
};

export function CreateClientDialog({
  trigger,
  allocationOptions,
  defaultOwnerUserId,
}: CreateClientDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [allocationId, setAllocationId] = React.useState(allocationOptions[0]?.id ?? "");
  const [ownerUserId, setOwnerUserId] = React.useState(defaultOwnerUserId);
  const mutation = useCreateClient();

  React.useEffect(() => {
    if (!allocationId && allocationOptions[0]) {
      setAllocationId(allocationOptions[0].id);
    }
  }, [allocationId, allocationOptions]);

  const valid = name.trim().length >= 2 && allocationId && ownerUserId.trim().length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    try {
      await mutation.mutateAsync({
        name: name.trim(),
        allocation_id: allocationId,
        owner_user_id: ownerUserId.trim(),
      });
      toast.success("Client created");
      setOpen(false);
      setName("");
    } catch (err) {
      toast.error(err instanceof ApiError ? `Create failed (${err.status})` : "Create failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New client</DialogTitle>
            <DialogDescription>
              Mint a client_id / client_secret pair tied to an allocation. The secret is shown once
              on creation in a real deployment; here only the last-4 is surfaced.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="client-name">Name</Label>
            <Input
              id="client-name"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              placeholder="e.g. Genomics CI pipeline"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-allocation-select">Allocation</Label>
            <select
              id="client-allocation-select"
              value={allocationId}
              onChange={(e) => setAllocationId(e.currentTarget.value)}
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {allocationOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.id})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="client-owner-id">Owner user ID</Label>
            <Input
              id="client-owner-id"
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.currentTarget.value)}
            />
          </div>

          <DialogFooter>
            <DialogClose
              render={
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={!valid || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
