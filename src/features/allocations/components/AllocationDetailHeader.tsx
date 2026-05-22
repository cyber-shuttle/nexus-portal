"use client";

import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { MetaItem, MetaRow } from "@/shared/ui/MetaRow";
import { StatCard, StatCardRow } from "@/shared/ui/StatCard";
import type { ComputeAllocation, ComputeAllocationResource } from "@features/allocations/schemas";
import { Calendar, Cpu, CreditCard, UserSquare, Users } from "lucide-react";

// Per-resource progress card input — `used` is SUs aggregated from the
// allocation's usage rows; `total` is the resource's `resource_amount`. The
// card label says "hrs" per spec §8; we don't have a rate-aware conversion
// wired here, so the numbers are displayed at SU resolution (rate = 1).
export type AllocationDetailHeaderResource = {
  id: string;
  name: string;
  used: number;
  total: number;
};

export type AllocationDetailHeaderProps = {
  allocation: ComputeAllocation;
  piName: string | null;
  memberCount: number;
  resources: AllocationDetailHeaderResource[];
  remainingCredits: number;
  updatedAt: Date | number | null;
};

function isExpiredEndTime(endTime: string, now = new Date()): boolean {
  const t = new Date(endTime).getTime();
  return Number.isFinite(t) && t < now.getTime();
}

export function AllocationDetailHeader({
  allocation,
  piName,
  memberCount,
  resources,
  remainingCredits,
  updatedAt,
}: AllocationDetailHeaderProps) {
  // Status pill follows the allocation status, with an "expired" override when
  // an ACTIVE allocation has slipped past its end date (mirrors the old header).
  const expired = allocation.status === "ACTIVE" && isExpiredEndTime(allocation.end_time);
  const statusTone: "success" | "warning" | "danger" =
    allocation.status === "ACTIVE" && !expired
      ? "success"
      : allocation.status === "ACTIVE" && expired
        ? "warning"
        : "danger";
  const statusLabel = expired ? "Expired" : allocation.status === "ACTIVE" ? "Active" : "Inactive";

  // Show at most two resource cards next to the credits card so the row stays
  // a clean 3-up per §8.
  const visibleResources = resources.slice(0, 2);

  return (
    <header className="space-y-4">
      <h1 className="font-display text-[28px] font-bold leading-tight text-foreground">
        {allocation.name}
      </h1>
      <MetaRow>
        <MetaItem variant="status" tone={statusTone} value={statusLabel} />
        <MetaItem icon={UserSquare} label="PI" value={piName ?? "—"} />
        <MetaItem icon={Calendar} label="End date" value={formatDate(allocation.end_time)} />
        <MetaItem icon={Users} label="Users" value={memberCount} />
      </MetaRow>

      <StatCardRow>
        <StatCard
          variant="text"
          icon={CreditCard}
          title="Remaining ACCESS credits"
          value={formatNumber(remainingCredits)}
          sub={updatedAt ? `Updated ${formatRelative(updatedAt)}` : undefined}
        />
        {visibleResources.map((r) => {
          const percent = r.total > 0 ? (r.used / r.total) * 100 : 0;
          return (
            <StatCard
              key={r.id}
              variant="progress"
              icon={Cpu}
              title={r.name}
              value={`${formatNumber(r.used)}/${formatNumber(r.total)} hrs`}
              percent={percent}
            />
          );
        })}
      </StatCardRow>
    </header>
  );
}

// Helper for the container: given the bare allocation + per-resource usage,
// derive the StatCard input shape. Keeps the container thin.
export function buildHeaderResources(
  resources: ComputeAllocationResource[],
  usedByResource: Map<string, number>,
): AllocationDetailHeaderResource[] {
  return resources.map((r) => ({
    id: r.id,
    name: r.name,
    used: usedByResource.get(r.id) ?? 0,
    total: r.resource_amount,
  }));
}
