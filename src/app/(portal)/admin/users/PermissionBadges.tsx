import { cn } from "@/lib/utils";
import type { RWPermission } from "./permissions-data";

export function PermissionRW({ read, write }: RWPermission) {
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

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    Admin: "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]",
    PI: "bg-[color:var(--nexus-purple-50)] text-[color:var(--nexus-purple-700)]",
    "Allocation Manager": "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-800)]",
    Researcher: "bg-[color:var(--nexus-gray-100)] text-[color:var(--nexus-gray-600)]",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[role] ?? styles.Researcher}`}
    >
      {role}
    </span>
  );
}

export function PermissionChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--nexus-green-50)] px-2.5 py-1 text-xs font-medium text-[color:var(--nexus-green-700)]">
      {label}
    </span>
  );
}
