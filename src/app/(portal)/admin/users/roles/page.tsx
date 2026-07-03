import { UserManagementNav } from "../UserManagementNav";

export default function UserRolesPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-bold leading-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage user identities, access permissions, and roles across the portal. Control who can
          access resources, configure role assignments, and audit identity records.
        </p>
      </header>
      <UserManagementNav />
    </div>
  );
}
