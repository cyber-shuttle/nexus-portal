import { cn } from "@/lib/utils";
import type { PacketStatus, ReplyStatus } from "../types";

const packetStyles: Record<PacketStatus, string> = {
  NEW: "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)] ring-[color:var(--nexus-blue-200)]",
  DECODED:
    "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)] ring-[color:var(--nexus-amber-200)]",
  PROCESSED:
    "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)] ring-[color:var(--nexus-green-200)]",
  FAILED:
    "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)] ring-[color:var(--nexus-red-200)]",
};

const replyStyles: Record<ReplyStatus, string> = {
  PENDING:
    "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)] ring-[color:var(--nexus-amber-200)]",
  SENT: "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)] ring-[color:var(--nexus-blue-200)]",
  ACKED:
    "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)] ring-[color:var(--nexus-green-200)]",
  FAILED:
    "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)] ring-[color:var(--nexus-red-200)]",
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
  // Per spec: a FAILED packet >24h old is louder. Use a deeper red ring + bold.
  const loud = status === "FAILED" && ageHours !== undefined && ageHours > 24;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        packetStyles[status],
        loud && "ring-2 ring-[color:var(--nexus-red-400)] font-semibold",
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
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        replyStyles[status],
        className,
      )}
    >
      {status}
    </span>
  );
}
