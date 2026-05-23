"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { Avatar, AvatarFallback } from "@/shared/ui/avatar";
import { getMembershipsForAllocation } from "@features/members/api";
import { memberKeys, useUser } from "@features/members/queries";
import type { ComputeAllocation } from "@features/projects/schemas";
import { useQueries } from "@tanstack/react-query";
import * as React from "react";

// Project-scoped members are the distinct user-set across every membership on
// every allocation of the project. We compose here rather than reuse the
// allocation-scoped MembersTab because that one shows per-membership actions
// (deactivate/remove) keyed to a single allocation id — there's no single
// allocation context at the project level.

export type ProjectMembersTabProps = {
  allocations: ComputeAllocation[];
  piUserId: string;
};

type ProjectMemberRow = {
  userId: string;
  // Number of the project's allocations the user belongs to. Surfaces "this
  // user touches 3 of 5 allocations" without needing a separate count column.
  allocationsCount: number;
  // Sorted earliest start across all the user's memberships in this project —
  // a stable proxy for "member since" at the project scope.
  earliestStart: string | null;
};

function initialsFromEmail(email?: string | null): string {
  if (!email) return "?";
  return email[0]?.toUpperCase() ?? "?";
}

function MemberRowCell({ userId, isPi }: { userId: string; isPi: boolean }) {
  const userQuery = useUser(userId);
  const user = userQuery.data;
  const name =
    user?.first_name || user?.last_name
      ? [user?.first_name, user?.last_name].filter(Boolean).join(" ")
      : (user?.email ?? userId);
  const initials =
    user?.first_name?.[0] && user?.last_name?.[0]
      ? `${user.first_name[0]}${user.last_name[0]}`.toUpperCase()
      : initialsFromEmail(user?.email ?? userId);
  return (
    <div className="flex items-center gap-3">
      <Avatar className="size-8">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{name}</span>
          {isPi ? (
            <span className="inline-flex rounded-full bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand">
              PI
            </span>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">{user?.email ?? userId}</div>
      </div>
    </div>
  );
}

export function ProjectMembersTab({ allocations, piUserId }: ProjectMembersTabProps) {
  // Fan out: one /memberships call per allocation. The volume is bounded by
  // the project's allocation count (typically <10).
  const membershipQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: memberKeys.forAllocation(a.id),
      queryFn: () => getMembershipsForAllocation(a.id),
      enabled: Boolean(a.id),
    })),
  });

  const rows = React.useMemo<ProjectMemberRow[]>(() => {
    const byUser = new Map<string, ProjectMemberRow>();
    for (const q of membershipQueries) {
      const rowsForAlloc = (q.data ?? []) as Array<{ user_id: string; start_time: string }>;
      for (const m of rowsForAlloc) {
        const existing = byUser.get(m.user_id);
        if (existing) {
          existing.allocationsCount += 1;
          if (!existing.earliestStart || m.start_time < existing.earliestStart) {
            existing.earliestStart = m.start_time;
          }
        } else {
          byUser.set(m.user_id, {
            userId: m.user_id,
            allocationsCount: 1,
            earliestStart: m.start_time,
          });
        }
      }
    }
    // PI sorted first; then by allocations-count desc; then by user id for stability.
    return Array.from(byUser.values()).sort((a, b) => {
      if (a.userId === piUserId) return -1;
      if (b.userId === piUserId) return 1;
      if (a.allocationsCount !== b.allocationsCount) {
        return b.allocationsCount - a.allocationsCount;
      }
      return a.userId.localeCompare(b.userId);
    });
  }, [membershipQueries, piUserId]);

  const isLoading = membershipQueries.some((q) => q.isLoading);
  const error =
    (membershipQueries.find((q) => q.error)?.error as Error | undefined) ?? null;

  const columns: Array<DataTableColumn<ProjectMemberRow>> = [
    {
      key: "member",
      header: "Member",
      cell: (row) => <MemberRowCell userId={row.userId} isPi={row.userId === piUserId} />,
    },
    {
      key: "allocations",
      header: "# Allocations",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.allocationsCount}</span>,
    },
    {
      key: "since",
      header: "Member since",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.earliestStart ? new Date(row.earliestStart).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  if (isLoading) return <TableSkeleton rows={4} columns={3} />;
  if (error) return <ErrorState message={error.message} onRetry={() => undefined} />;
  if (rows.length === 0) {
    return (
      <EmptyState
        heading="No members yet"
        description="Add members on each allocation to populate this project view."
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {rows.length} distinct member{rows.length === 1 ? "" : "s"} across {allocations.length}{" "}
        allocation{allocations.length === 1 ? "" : "s"}.
      </p>
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.userId} />
    </div>
  );
}
