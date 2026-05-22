import { cn } from "@/lib/utils";
import type { PacketStatus, ReplyStatus } from "../types";

const packetStyles: Record<PacketStatus, string> = {
  NEW: "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]",
  DECODED: "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)]",
  PROCESSED: "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)]",
  FAILED: "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)]",
};

const replyStyles: Record<ReplyStatus, string> = {
  PENDING: "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)]",
  SENT: "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]",
  ACKED: "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)]",
  FAILED: "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)]",
};

export function PacketStatusBadge({
  status,
  ageHours,
  className,
}: {
  status: PacketStatus;
  ageHours?: number;
  className?: string;
}) {
  // Aged-FAILED packets stay louder via weight + the trailing "!" — no ring.
  const loud = status === "FAILED" && ageHours !== undefined && ageHours > 24;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        packetStyles[status],
        loud && "font-semibold",
        className,
      )}
    >
      {status}
      {loud ? <span aria-hidden="true">!</span> : null}
    </span>
  );
}

export function ReplyStatusBadge({
  status,
  className,
}: {
  status: ReplyStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        replyStyles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
