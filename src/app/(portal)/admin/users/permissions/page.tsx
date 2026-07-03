"use client";

import { SideDrawer } from "@/shared/ui/SideDrawer";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { ChevronRight, Plus } from "lucide-react";
import * as React from "react";
import { AddPermissionDialog } from "../AddPermissionDialog";
import { PermissionChip, PermissionRW, RoleBadge } from "../PermissionBadges";
import { USERS, type UserPermissionRecord } from "../permissions-data";

function PermissionsDrawer({
  user,
  open,
  onOpenChange,
  modal,
  onAddPermission,
}: {
  user: UserPermissionRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal?: boolean;
  onAddPermission: (userId: string) => void;
}) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={user?.name ?? "Permissions"}
      description={user ? `${user.email} · ${user.role}` : undefined}
      width="sm"
      modal={modal}
    >
      {user && (
        <div className="space-y-5">
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Core permissions
            </h3>
            <ul className="space-y-2">
              {[
                { label: "Manage Allocations", value: user.canManageAllocations },
                { label: "View Reports", value: user.canViewReports },
                { label: "Manage Users", value: user.canManageUsers },
              ].map((p) => (
                <li key={p.label} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{p.label}</span>
                  <PermissionRW read={p.value.read} write={p.value.write} />
                </li>
              ))}
            </ul>
          </section>

          <div className="border-t border-border" />

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Additional permissions
              </h3>
              {!user.isMe && (
                <Button variant="outline" size="xs" onClick={() => onAddPermission(user.id)}>
                  <Plus data-icon="inline-start" />
                  Add
                </Button>
              )}
            </div>
            {user.extra.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional permissions.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {user.extra.map((p) => (
                  <PermissionChip key={p.key} label={p.label} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </SideDrawer>
  );
}

export default function UserPermissionsPage() {
  const [users, setUsers] = React.useState(USERS);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [addPermissionForId, setAddPermissionForId] = React.useState<string | null>(null);

  const me = users.find((u) => u.isMe)!;
  const others = users.filter((u) => !u.isMe);
  const selected = users.find((u) => u.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="pl-4">User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-center">Manage Allocations</TableHead>
              <TableHead className="text-center">View Reports</TableHead>
              <TableHead className="text-center">Manage Users</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Own user row */}
            <TableRow
              className="cursor-pointer bg-[color:var(--nexus-blue-50)]/40 hover:bg-[color:var(--nexus-blue-50)]/60"
              onClick={() => setSelectedId(me.id)}
            >
              <TableCell className="pl-4">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{me.name}</span>
                  <span className="text-xs text-muted-foreground">{me.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <RoleBadge role={me.role} />
              </TableCell>
              <TableCell className="text-center">
                <PermissionRW {...me.canManageAllocations} />
              </TableCell>
              <TableCell className="text-center">
                <PermissionRW {...me.canViewReports} />
              </TableCell>
              <TableCell className="text-center">
                <PermissionRW {...me.canManageUsers} />
              </TableCell>
              <TableCell className="pr-4 text-right">
                <div className="flex items-center justify-end gap-1 text-xs text-[color:var(--nexus-blue-600)]">
                  <span>You</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </div>
              </TableCell>
            </TableRow>

            {/* Other users */}
            {others.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onClick={() => setSelectedId(user.id)}
              >
                <TableCell className="pl-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell className="text-center">
                  <PermissionRW {...user.canManageAllocations} />
                </TableCell>
                <TableCell className="text-center">
                  <PermissionRW {...user.canViewReports} />
                </TableCell>
                <TableCell className="text-center">
                  <PermissionRW {...user.canManageUsers} />
                </TableCell>
                <TableCell className="pr-4 text-right">
                  <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PermissionsDrawer
        user={selected}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
        modal={false}
        onAddPermission={(userId) => setAddPermissionForId(userId)}
      />

      <AddPermissionDialog
        open={addPermissionForId !== null}
        onOpenChange={(open) => {
          if (!open) setAddPermissionForId(null);
        }}
        subjectLabel={users.find((u) => u.id === addPermissionForId)?.name ?? "this user"}
        onAdd={(permission) => {
          setUsers((prev) =>
            prev.map((u) =>
              u.id === addPermissionForId ? { ...u, extra: [...u.extra, permission] } : u,
            ),
          );
        }}
      />
    </div>
  );
}
