"use client";

import * as React from "react";
import { useAllocationMembers, type AllocationMemberRow } from "../queries";
import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { TableSkeleton } from "@/shared/ui/Loading";
import { ErrorState } from "@/shared/ui/ErrorState";
import { EmptyState } from "@/shared/ui/EmptyState";
import { StatusBadge, statusBadgeVariantFromAllocationStatus } from "@/shared/ui/StatusBadge";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { MemberDetailDrawer } from "./MemberDetailDrawer";

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
};

export function MembersTab({ allocationId, piUserId }: MembersTabProps) {
  const { data: rows, isLoading, error, refetch } = useAllocationMembers(allocationId);

  const [activeMember, setActiveMember] = React.useState<AllocationMemberRow | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

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
                ? "inline-flex rounded-full bg-[color:var(--nexus-blue-50)] px-2 py-0.5 text-xs font-medium text-[color:var(--nexus-blue-700)]"
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
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {(rows ?? []).length} member{(rows ?? []).length === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            Roles: PI, Co-PI, Allocation Manager, User
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                aria-disabled
                aria-label="Manage members (available in Phase 3)"
                className="opacity-50 cursor-not-allowed"
                onClick={(e) => e.preventDefault()}
              >
                Manage members
              </Button>
            }
          />
          <TooltipContent>Available in Phase 3</TooltipContent>
        </Tooltip>
      </div>
      {isLoading ? (
        <TableSkeleton rows={5} columns={4} />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => refetch()} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          heading="No members yet"
          description="This allocation has no active memberships."
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.membership.id}
          onRowClick={(row) => {
            setActiveMember(row);
            setDrawerOpen(true);
          }}
        />
      )}
      <MemberDetailDrawer open={drawerOpen} onOpenChange={setDrawerOpen} member={activeMember} />
    </div>
  );
}
