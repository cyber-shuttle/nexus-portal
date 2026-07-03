"use client";

import { cn } from "@/lib/utils";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { ChevronRight } from "lucide-react";
import * as React from "react";

type Permission = {
  key: string;
  label: string;
};

type RWPermission = {
  read: boolean;
  write: boolean;
};

type UserPermission = {
  id: string;
  name: string;
  email: string;
  role: string;
  canManageAllocations: RWPermission;
  canViewReports: RWPermission;
  canManageUsers: RWPermission;
  extra: Permission[];
  isMe?: boolean;
};

const USERS: UserPermission[] = [
  {
    id: "me",
    name: "Nipuna Bandara",
    email: "nipuna@folia.com",
    role: "Admin",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: true },
    canManageUsers: { read: true, write: true },
    isMe: true,
    extra: [
      { key: "manage_clients", label: "Manage Clients" },
      { key: "manage_resources", label: "Manage Resources" },
      { key: "manage_rates", label: "Manage Rates" },
      { key: "retry_traces", label: "Retry Traces" },
      { key: "view_traces", label: "View Traces" },
      { key: "manage_adjustments", label: "Manage Adjustments" },
    ],
  },
  {
    id: "u1",
    name: "Rachel Gao",
    email: "rgao@access-ci.org",
    role: "PI",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "create_proposals", label: "Create Proposals" },
      { key: "manage_membership", label: "Manage Membership" },
      { key: "approve_change_requests", label: "Approve Change Requests" },
      { key: "view_analytics", label: "View Analytics (PI)" },
    ],
  },
  {
    id: "u2",
    name: "James Okonkwo",
    email: "jokonkwo@university.edu",
    role: "Researcher",
    canManageAllocations: { read: false, write: false },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "view_analytics", label: "View Analytics (Self)" },
      { key: "create_change_requests", label: "Create Change Requests" },
    ],
  },
  {
    id: "u3",
    name: "Priya Sharma",
    email: "psharma@hpc-lab.org",
    role: "Allocation Manager",
    canManageAllocations: { read: true, write: true },
    canViewReports: { read: true, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "approve_change_requests", label: "Approve Change Requests" },
      { key: "manage_membership", label: "Manage Membership" },
      { key: "view_analytics", label: "View Analytics (Self)" },
    ],
  },
  {
    id: "u4",
    name: "Daniel Wu",
    email: "dwu@nexus-hpc.io",
    role: "Researcher",
    canManageAllocations: { read: false, write: false },
    canViewReports: { read: false, write: false },
    canManageUsers: { read: false, write: false },
    extra: [
      { key: "create_change_requests", label: "Create Change Requests" },
    ],
  },
];

function PermissionRW({ read, write }: RWPermission) {
  return (
    <div className="flex items-center justify-center gap-1">
      <span
        title="Read"
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold",
          read
            ? "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]"
            : "bg-[color:var(--nexus-gray-100)] text-[color:var(--nexus-gray-400)]",
        )}
      >
        R
      </span>
      <span
        title="Write"
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold",
          write
            ? "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)]"
            : "bg-[color:var(--nexus-gray-100)] text-[color:var(--nexus-gray-400)]",
        )}
      >
        W
      </span>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    Admin: "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]",
    PI: "bg-[color:var(--nexus-purple-50)] text-[color:var(--nexus-purple-700)]",
    "Allocation Manager": "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-800)]",
    Researcher: "bg-[color:var(--nexus-gray-100)] text-[color:var(--nexus-gray-600)]",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[role] ?? styles.Researcher}`}>
      {role}
    </span>
  );
}

function PermissionsDrawer({
  user,
  open,
  onOpenChange,
  modal,
}: {
  user: UserPermission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modal?: boolean;
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
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Additional permissions
            </h3>
            {user.extra.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional permissions.</p>
            ) : (
              <ul className="space-y-2">
                {user.extra.map((p) => (
                  <li key={p.key} className="flex items-center gap-2 text-sm">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)]">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                        <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="text-foreground">{p.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </SideDrawer>
  );
}

export default function UserPermissionsPage() {
  const [selected, setSelected] = React.useState<UserPermission | null>(null);

  const me = USERS.find((u) => u.isMe)!;
  const others = USERS.filter((u) => !u.isMe);

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
              onClick={() => setSelected(me)}
            >
              <TableCell className="pl-4">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{me.name}</span>
                  <span className="text-xs text-muted-foreground">{me.email}</span>
                </div>
              </TableCell>
              <TableCell><RoleBadge role={me.role} /></TableCell>
              <TableCell className="text-center"><PermissionRW {...me.canManageAllocations} /></TableCell>
              <TableCell className="text-center"><PermissionRW {...me.canViewReports} /></TableCell>
              <TableCell className="text-center"><PermissionRW {...me.canManageUsers} /></TableCell>
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
                onClick={() => setSelected(user)}
              >
                <TableCell className="pl-4">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground">{user.name}</span>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                </TableCell>
                <TableCell><RoleBadge role={user.role} /></TableCell>
                <TableCell className="text-center"><PermissionRW {...user.canManageAllocations} /></TableCell>
                <TableCell className="text-center"><PermissionRW {...user.canViewReports} /></TableCell>
                <TableCell className="text-center"><PermissionRW {...user.canManageUsers} /></TableCell>
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
        onOpenChange={(open) => { if (!open) setSelected(null); }}
        modal={false}
      />
    </div>
  );
}
