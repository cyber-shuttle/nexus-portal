"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import type { ComputeAllocationChangeRequest } from "@shared/api/domain";
import { ApiError } from "@shared/api/client";
import {
  useApproveChangeRequest,
  useChangeRequestsForUser,
  useDenyChangeRequest,
} from "@features/change-requests/queries";
import { useAdminChangeRequests } from "@features/admin/queries";
import { useMembershipsForUser } from "@features/members/queries";
import {
  ChangeRequestsList,
  type ChangeRequestRowAction,
} from "@features/change-requests/components/ChangeRequestsList";
import { ChangeRequestDetailDrawer } from "@features/change-requests/components/ChangeRequestDetailDrawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";

type Persona = "user" | "pi" | "allocation_manager" | "admin";

function personaFromRole(role: string | undefined): Persona {
  if (role === "admin") return "admin";
  if (role === "allocation_manager") return "allocation_manager";
  if (role === "pi" || role === "co_pi") return "pi";
  return "user";
}

export function ChangeRequestsListContainer() {
  const { data: session } = useSession();
  const persona = personaFromRole(session?.user?.role);
  const userId = session?.user?.id ?? "";

  const adminQuery = useAdminChangeRequests({
    status: "PENDING,APPROVED,REJECTED",
    limit: 500,
  });
  const userQuery = useChangeRequestsForUser(persona !== "admin" ? userId : undefined);
  const membershipsQuery = useMembershipsForUser(
    persona === "pi" || persona === "allocation_manager" ? userId : undefined,
  );

  const myPiAllocations = React.useMemo(
    () => new Set(session?.user?.myPiAllocations ?? []),
    [session?.user?.myPiAllocations],
  );
  const assignedAllocations = React.useMemo(
    () => new Set(session?.user?.assignedAllocations ?? []),
    [session?.user?.assignedAllocations],
  );

  const { rows, isLoading, error, refetch } = React.useMemo(() => {
    if (persona === "admin") {
      return {
        rows: adminQuery.data ?? [],
        isLoading: adminQuery.isLoading,
        error: (adminQuery.error as Error | null) ?? null,
        refetch: () => adminQuery.refetch(),
      };
    }
    const own = userQuery.data ?? [];
    if (persona === "pi") {
      const scopedAllocations = new Set([
        ...myPiAllocations,
        ...((membershipsQuery.data ?? []).map((m) => m.compute_allocation_id)),
      ]);
      const scopedFromAdmin = (adminQuery.data ?? []).filter((r) =>
        scopedAllocations.has(r.compute_allocation_id),
      );
      const seen = new Set<string>();
      const merged: ComputeAllocationChangeRequest[] = [];
      for (const r of [...own, ...scopedFromAdmin]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        merged.push(r);
      }
      return {
        rows: merged,
        isLoading: userQuery.isLoading || adminQuery.isLoading,
        error: (userQuery.error as Error | null) ?? (adminQuery.error as Error | null),
        refetch: () => {
          userQuery.refetch();
          adminQuery.refetch();
        },
      };
    }
    if (persona === "allocation_manager") {
      const scopedFromAdmin = (adminQuery.data ?? []).filter((r) =>
        assignedAllocations.has(r.compute_allocation_id),
      );
      const seen = new Set<string>();
      const merged: ComputeAllocationChangeRequest[] = [];
      for (const r of [...own, ...scopedFromAdmin]) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        merged.push(r);
      }
      return {
        rows: merged,
        isLoading: userQuery.isLoading || adminQuery.isLoading,
        error: (userQuery.error as Error | null) ?? (adminQuery.error as Error | null),
        refetch: () => {
          userQuery.refetch();
          adminQuery.refetch();
        },
      };
    }
    return {
      rows: own,
      isLoading: userQuery.isLoading,
      error: (userQuery.error as Error | null) ?? null,
      refetch: () => userQuery.refetch(),
    };
  }, [
    persona,
    adminQuery.data,
    adminQuery.isLoading,
    adminQuery.error,
    adminQuery,
    userQuery.data,
    userQuery.isLoading,
    userQuery.error,
    userQuery,
    membershipsQuery.data,
    myPiAllocations,
    assignedAllocations,
  ]);

  const canActOn = React.useCallback(
    (row: ComputeAllocationChangeRequest) => {
      if (persona === "admin") return true;
      if (persona === "pi") return myPiAllocations.has(row.compute_allocation_id);
      if (persona === "allocation_manager") return assignedAllocations.has(row.compute_allocation_id);
      return false;
    },
    [persona, myPiAllocations, assignedAllocations],
  );

  const approveMutation = useApproveChangeRequest();
  const denyMutation = useDenyChangeRequest();

  const [pendingMutationIds, setPendingMutationIds] = React.useState<Set<string>>(new Set());
  const [detailRow, setDetailRow] = React.useState<ComputeAllocationChangeRequest | null>(null);
  const [confirm, setConfirm] = React.useState<
    | null
    | {
        kind: "approve" | "deny";
        ids: string[];
      }
  >(null);

  async function runAction(kind: "approve" | "deny", ids: string[]) {
    setPendingMutationIds(new Set([...pendingMutationIds, ...ids]));
    let okCount = 0;
    let failCount = 0;
    for (const id of ids) {
      try {
        if (kind === "approve") {
          await approveMutation.mutateAsync({ id, approverId: userId });
        } else {
          await denyMutation.mutateAsync({ id, approverId: userId });
        }
        okCount += 1;
      } catch (err) {
        failCount += 1;
        const msg =
          err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Action failed";
        toast.error(msg);
      }
    }
    if (okCount > 0) {
      const verb = kind === "approve" ? "Approved" : "Denied";
      toast.success(`${verb} ${okCount} request${okCount === 1 ? "" : "s"}`);
    }
    if (failCount === 0 || okCount > 0) {
      // best-effort; the mutation hooks already invalidate query caches.
    }
    setPendingMutationIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }

  function onAction(row: ComputeAllocationChangeRequest, action: ChangeRequestRowAction) {
    if (action.kind === "view") {
      setDetailRow(row);
      return;
    }
    setConfirm({ kind: action.kind, ids: [row.id] });
  }

  function onBulkApprove(ids: string[]) {
    if (ids.length === 0) return;
    setConfirm({ kind: "approve", ids });
  }

  function onBulkDeny(ids: string[]) {
    if (ids.length === 0) return;
    setConfirm({ kind: "deny", ids });
  }

  const bulkActionsEnabled = persona === "admin" || persona === "allocation_manager";

  return (
    <>
      <ChangeRequestsList
        rows={rows}
        isLoading={isLoading}
        error={error}
        canActOn={canActOn}
        onAction={onAction}
        onRetry={refetch}
        pendingMutationIds={pendingMutationIds}
        bulkActionsEnabled={bulkActionsEnabled}
        onBulkApprove={bulkActionsEnabled ? onBulkApprove : undefined}
        onBulkDeny={bulkActionsEnabled ? onBulkDeny : undefined}
      />
      <ChangeRequestDetailDrawer
        open={Boolean(detailRow)}
        onOpenChange={(open) => {
          if (!open) setDetailRow(null);
        }}
        request={detailRow}
      />
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "approve" ? "Approve" : "Deny"} {confirm?.ids.length} request
              {confirm && confirm.ids.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This will set the status and append an event to the audit timeline. Action cannot
              be undone without admin support.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!confirm) return;
                const c = confirm;
                setConfirm(null);
                await runAction(c.kind, c.ids);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
