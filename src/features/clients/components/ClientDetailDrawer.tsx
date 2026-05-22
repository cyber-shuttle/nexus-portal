"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { StatusBadge, type StatusBadgeVariant } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ApiError } from "@shared/api/client";
import * as React from "react";
import { toast } from "sonner";
import { useDeactivateClient, useRotateClientSecret } from "../queries";
import type { Client, ClientStatus } from "../types";

function statusVariant(status: ClientStatus): StatusBadgeVariant {
  return status === "active" ? "active" : "inactive";
}

export type ClientDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | undefined;
  isLoading: boolean;
  error: Error | null;
  canManage: boolean;
  currentUserId: string;
  onRetry?: () => void;
};

export function ClientDetailDrawer({
  open,
  onOpenChange,
  client,
  isLoading,
  error,
  canManage,
  currentUserId,
  onRetry,
}: ClientDetailDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      width="md"
      title={client ? client.name : "Client"}
      description={client ? client.client_id : undefined}
    >
      {isLoading ? (
        <CenteredSpinner label="Loading client" />
      ) : error ? (
        <ErrorState message={error.message ?? "Failed to load client"} onRetry={onRetry} />
      ) : !client ? (
        <p className="text-sm text-muted-foreground">Client not found.</p>
      ) : (
        <ClientDetailBody client={client} canManage={canManage} currentUserId={currentUserId} />
      )}
    </SideDrawer>
  );
}

function ClientDetailBody({
  client,
  canManage,
  currentUserId,
}: {
  client: Client;
  canManage: boolean;
  currentUserId: string;
}) {
  const [reason, setReason] = React.useState("");
  const rotate = useRotateClientSecret();
  const deactivate = useDeactivateClient();
  const reasonValid = reason.trim().length >= 3;
  const isActive = client.status === "active";

  async function onRotate() {
    try {
      await rotate.mutateAsync({
        id: client.id,
        payload: { rotated_by: currentUserId },
      });
      toast.success("Client secret rotated");
    } catch (err) {
      toast.error(err instanceof ApiError ? `Rotate failed (${err.status})` : "Rotate failed");
    }
  }

  async function onDeactivate() {
    if (!reasonValid) return;
    try {
      await deactivate.mutateAsync({
        id: client.id,
        payload: { deactivated_by: currentUserId, reason: reason.trim() },
      });
      toast.success("Client deactivated");
    } catch (err) {
      toast.error(
        err instanceof ApiError ? `Deactivate failed (${err.status})` : "Deactivate failed",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="mt-1">
            <StatusBadge
              variant={statusVariant(client.status)}
              label={client.status.toUpperCase()}
            />
          </div>
        </div>
      </div>

      <dl className="space-y-2 text-sm">
        <Row label="Client ID" value={client.client_id} mono />
        <Row label="Allocation" value={client.allocation_name ?? client.allocation_id} />
        <Row label="Owner" value={client.owner_user_id} />
        <Row label="Secret · last 4" value={`…${client.client_secret_last4}`} mono />
        <Row label="Issued at" value={new Date(client.issued_at).toLocaleString()} />
        <Row
          label="Last rotated"
          value={
            client.last_rotated_at ? new Date(client.last_rotated_at).toLocaleString() : "Never"
          }
        />
      </dl>

      {canManage && isActive && (
        <div className="space-y-4 rounded-md border border-dashed bg-muted/30 p-4">
          <div className="space-y-2">
            <h3 className="font-heading text-sm font-semibold">Rotate secret</h3>
            <p className="text-xs text-muted-foreground">
              The previous secret is invalidated immediately. Distribute the new secret to the
              workload before re-enabling.
            </p>
            <Button onClick={onRotate} disabled={rotate.isPending} variant="outline" size="sm">
              {rotate.isPending ? "Rotating…" : "Rotate secret"}
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-heading text-sm font-semibold">Deactivate</h3>
            <Label htmlFor="deactivate-reason">Reason</Label>
            <Input
              id="deactivate-reason"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
              placeholder="Why is this client being deactivated?"
            />
            <Button
              onClick={onDeactivate}
              disabled={!reasonValid || deactivate.isPending}
              variant="destructive"
              size="sm"
            >
              {deactivate.isPending ? "Deactivating…" : "Deactivate client"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-3 rounded-md bg-muted/30 px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "break-words"}>{value}</dd>
    </div>
  );
}
