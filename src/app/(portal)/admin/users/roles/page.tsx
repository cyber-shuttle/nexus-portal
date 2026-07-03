"use client";

import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Plus } from "lucide-react";
import * as React from "react";
import { AddPermissionDialog } from "../AddPermissionDialog";
import { PermissionChip, PermissionRW, RoleBadge } from "../PermissionBadges";
import { ROLE_PERMISSIONS } from "../permissions-data";

export default function UserRolesPage() {
  const [roles, setRoles] = React.useState(ROLE_PERMISSIONS);
  const [addPermissionForRole, setAddPermissionForRole] = React.useState<string | null>(null);

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <Card key={role.role} className="gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <RoleBadge role={role.role} />
              <p className="text-sm text-muted-foreground">{role.description}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddPermissionForRole(role.role)}>
              <Plus data-icon="inline-start" />
              Add Permission
            </Button>
          </div>

          <div className="border-t border-border" />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Manage Allocations", value: role.canManageAllocations },
              { label: "View Reports", value: role.canViewReports },
              { label: "Manage Users", value: role.canManageUsers },
            ].map((p) => (
              <div
                key={p.label}
                className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
              >
                <span className="text-sm text-foreground">{p.label}</span>
                <PermissionRW read={p.value.read} write={p.value.write} />
              </div>
            ))}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Additional permissions
            </h3>
            {role.extra.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional permissions.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {role.extra.map((p) => (
                  <PermissionChip key={p.key} label={p.label} />
                ))}
              </div>
            )}
          </div>
        </Card>
      ))}

      <AddPermissionDialog
        open={addPermissionForRole !== null}
        onOpenChange={(open) => {
          if (!open) setAddPermissionForRole(null);
        }}
        subjectLabel={addPermissionForRole ? `the ${addPermissionForRole} role` : "this role"}
        onAdd={(permission) => {
          setRoles((prev) =>
            prev.map((r) =>
              r.role === addPermissionForRole ? { ...r, extra: [...r.extra, permission] } : r,
            ),
          );
        }}
      />
    </div>
  );
}
