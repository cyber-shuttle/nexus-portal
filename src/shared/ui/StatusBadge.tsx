import { cn } from "@/lib/utils";
import type { AllocationStatus, ChangeRequestStatus } from "@shared/api/domain";

export type StatusBadgeVariant =
  | "active"
  | "inactive"
  | "deleted"
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "warning";

const variantStyles: Record<StatusBadgeVariant, string> = {
  active:
    "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)] ring-1 ring-inset ring-[color:var(--nexus-green-200)]",
  inactive:
    "bg-[color:var(--nexus-gray-100)] text-[color:var(--nexus-gray-700)] ring-1 ring-inset ring-[color:var(--nexus-gray-200)]",
  deleted:
    "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)] ring-1 ring-inset ring-[color:var(--nexus-red-200)]",
  pending:
    "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)] ring-1 ring-inset ring-[color:var(--nexus-blue-200)]",
  approved:
    "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)] ring-1 ring-inset ring-[color:var(--nexus-green-200)]",
  rejected:
    "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)] ring-1 ring-inset ring-[color:var(--nexus-red-200)]",
  expired:
    "bg-[color:var(--nexus-gray-100)] text-[color:var(--nexus-gray-700)] ring-1 ring-inset ring-[color:var(--nexus-gray-300)]",
  warning:
    "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)] ring-1 ring-inset ring-[color:var(--nexus-amber-200)]",
};

const labels: Record<StatusBadgeVariant, string> = {
  active: "Active",
  inactive: "Inactive",
  deleted: "Deleted",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  warning: "Warning",
};

export type StatusBadgeProps = {
  variant: StatusBadgeVariant;
  label?: string;
  className?: string;
};

export function StatusBadge({ variant, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
    >
      {label ?? labels[variant]}
    </span>
  );
}

export function statusBadgeVariantFromAllocationStatus(
  status: AllocationStatus,
): StatusBadgeVariant {
  if (status === "ACTIVE") return "active";
  if (status === "INACTIVE") return "inactive";
  return "deleted";
}

export function statusBadgeVariantFromChangeRequest(
  status: ChangeRequestStatus,
): StatusBadgeVariant {
  if (status === "PENDING") return "pending";
  if (status === "APPROVED") return "approved";
  return "rejected";
}
