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
import { useRevokeCertificate } from "../queries";
import type { Certificate } from "../types";

export type RevokeDialogProps = {
  cert: Certificate;
  trigger: React.ReactElement;
};

export function RevokeDialog({ cert, trigger }: RevokeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("User requested revocation");
  const mutation = useRevokeCertificate();

  const reasonValid = reason.trim().length >= 3;

  async function onConfirm() {
    if (!reasonValid) return;
    try {
      await mutation.mutateAsync({
        serial: cert.serial_number,
        payload: { reason: reason.trim() },
      });
      toast.success(`Certificate ${cert.serial_number} revoked`);
      setOpen(false);
    } catch (err) {
      const message = err instanceof ApiError ? `Revoke failed (${err.status})` : "Revoke failed";
      toast.error(message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke certificate?</DialogTitle>
          <DialogDescription>
            Serial {cert.serial_number} for {cert.username || cert.principal} will be marked revoked
            immediately. This is irreversible.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="revoke-reason">Reason</Label>
          <Input
            id="revoke-reason"
            value={reason}
            onChange={(e) => setReason(e.currentTarget.value)}
            placeholder="Explain why you're revoking"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!reasonValid || mutation.isPending}
          >
            {mutation.isPending ? "Revoking…" : "Confirm revoke"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
