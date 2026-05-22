"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { StatusBadge, statusBadgeVariantFromAllocationStatus } from "@/shared/ui/StatusBadge";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ApiError } from "@shared/api/client";
import * as React from "react";
import { toast } from "sonner";
import {
  type AllocationMemberRow,
  useAllocationMembers,
  useDeleteMembership,
  useSetMembershipStatus,
} from "../queries";
import { MemberDetailDrawer } from "./MemberDetailDrawer";
import { OverridesDrawer, type OverridesDrawerResource } from "./OverridesDrawer";

function initials(row: AllocationMemberRow): string {
  if (!row.user) return "?";
  const first = row.user.first_name?.[0] ?? "";
  const last = row.user.last_name?.[0] ?? "";
  const combined = `${first}${last}`.toUpperCase();
  if (combined) return combined;
  const emailFirst = row.user.email[0];
  return emailFirst ? emailFirst.toUpperCase() : "?";
}

function fullName(row: AllocationMemberRow): string {
  if (!row.user) return row.membership.user_id;
  const parts = [row.user.first_name, row.user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : row.user.email;
}

function roleFor(row: AllocationMemberRow, piUserId: string | undefined): string {
  if (piUserId && row.membership.user_id === piUserId) return "PI";
  return "User";
}

export type MembersTabProps = {
  allocationId: string;
  piUserId: string | undefined;
  canManage: boolean;
  resources: OverridesDrawerResource[];
};

type ConfirmState =
  | null
  | { kind: "deactivate"; membershipId: string; userLabel: string }
  | { kind: "activate"; membershipId: string; userLabel: string }
  | { kind: "remove"; membershipId: string; userId: string; userLabel: string };

export function MembersTab({
  allocationId,
  piUserId,
  canManage,
  resources,
}: MembersTabProps) {
  const { data: rows, isLoading, error, refetch } = useAllocationMembers(allocationId);
  const setStatusMutation = useSetMembershipStatus();
  const deleteMutation = useDeleteMembership();

  const [activeMember, setActiveMember] = React.useState<AllocationMemberRow | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  // Add-member drawer moved to the tab right-slot in AllocationDetailContainer
  // per §8 — MembersTab no longer owns that affordance.
  const [overridesFor, setOverridesFor] = React.useState<AllocationMemberRow | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState>(null);

  async function runConfirm(state: NonNullable<ConfirmState>) {
    try {
      if (state.kind === "deactivate") {
        await setStatusMutation.mutateAsync({ id: state.membershipId, status: "INACTIVE" });
        toast.success(`${state.userLabel} deactivated`);
      } else if (state.kind === "activate") {
        await setStatusMutation.mutateAsync({ id: state.membershipId, status: "ACTIVE" });
        toast.success(`${state.userLabel} reactivated`);
      } else {
        await deleteMutation.mutateAsync({
          id: state.membershipId,
          allocationId,
          userId: state.userId,
        });
        toast.success(`${state.userLabel} removed`);
      }
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Action failed";
      toast.error(msg);
    }
  }

  const columns: Array<DataTableColumn<AllocationMemberRow>> = [
    {
      key: "name",
      header: "Member",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback>{initials(row)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-foreground">{fullName(row)}</div>
            <div className="text-xs text-muted-foreground">
              {row.user?.email ?? row.membership.user_id}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (row) => {
        const role = roleFor(row, piUserId);
        return (
          <span
            className={
              role === "PI"
                ? "inline-flex rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand"
                : "inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
            }
          >
            {role}
          </span>
        );
      },
    },
    {
      key: "since",
      header: "Member since",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {new Date(row.membership.start_time).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <StatusBadge
          variant={statusBadgeVariantFromAllocationStatus(row.membership.membership_status)}
          label={row.membership.membership_status}
        />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => {
        const label = fullName(row);
        const status = row.membership.membership_status;
        const isPi = row.membership.user_id === piUserId;
        return (
          <div className="flex justify-end gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveMember(row);
                setDrawerOpen(true);
              }}
            >
              Details
            </Button>
            {canManage && !isPi ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`overrides-${row.membership.id}`}
                  onClick={() => setOverridesFor(row)}
                >
                  Overrides
                </Button>
                {status === "ACTIVE" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid={`deactivate-${row.membership.id}`}
                    onClick={() =>
                      setConfirm({
                        kind: "deactivate",
                        membershipId: row.membership.id,
                        userLabel: label,
                      })
                    }
                  >
                    Deactivate
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setConfirm({
                        kind: "activate",
                        membershipId: row.membership.id,
                        userLabel: label,
                      })
                    }
                  >
                    Activate
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  data-testid={`remove-${row.membership.id}`}
                  onClick={() =>
                    setConfirm({
                      kind: "remove",
                      membershipId: row.membership.id,
                      userId: row.membership.user_id,
                      userLabel: label,
                    })
                  }
                >
                  Remove
                </Button>
              </>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          {(rows ?? []).length} member{(rows ?? []).length === 1 ? "" : "s"}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          Roles: PI, Co-PI, Allocation Manager, User
        </span>
      </div>
      {isLoading ? (
        <TableSkeleton rows={5} columns={5} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          heading="No members yet"
          description="This allocation has no active memberships."
        />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(row) => row.membership.id} />
      )}
      <MemberDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} member={activeMember} />
      {overridesFor ? (
        <OverridesDrawer
          open={Boolean(overridesFor)}
          onOpenChange={(open) => {
            if (!open) setOverridesFor(null);
          }}
          membershipId={overridesFor.membership.id}
          memberLabel={fullName(overridesFor)}
          resources={resources}
        />
      ) : null}
      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm?.kind === "remove"
                ? `Remove ${confirm?.userLabel}?`
                : confirm?.kind === "deactivate"
                  ? `Deactivate ${confirm?.userLabel}?`
                  : `Reactivate ${confirm?.userLabel}?`}
            </DialogTitle>
            <DialogDescription>
              {confirm?.kind === "remove"
                ? "Removes the membership row. The user can be re-added later."
                : confirm?.kind === "deactivate"
                  ? "Sets membership_status to INACTIVE. Usage already recorded is preserved."
                  : "Sets membership_status back to ACTIVE."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              data-testid="confirm-action"
              onClick={async () => {
                if (!confirm) return;
                const c = confirm;
                setConfirm(null);
                await runConfirm(c);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
