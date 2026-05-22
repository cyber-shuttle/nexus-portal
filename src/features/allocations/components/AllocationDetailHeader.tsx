"use client";

import { useAllocation } from "../queries";
import { StatusBadge, statusBadgeVariantFromAllocationStatus } from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import { CardSkeleton } from "@/shared/ui/Loading";
import { ErrorState } from "@/shared/ui/ErrorState";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatSU(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export type AllocationDetailHeaderProps = {
  allocationId: string;
  used: number;
};

export function AllocationDetailHeader({ allocationId, used }: AllocationDetailHeaderProps) {
  const allocationQuery = useAllocation(allocationId);

  if (allocationQuery.isLoading) return <CardSkeleton />;
  if (allocationQuery.error) {
    return (
      <ErrorState
        message={(allocationQuery.error as Error).message}
        onRetry={() => allocationQuery.refetch()}
      />
    );
  }
  const allocation = allocationQuery.data;
  if (!allocation) return null;

  const remaining = Math.max(0, allocation.initial_su_amount - used);
  const now = new Date();
  const endTime = new Date(allocation.end_time);
  const isExpired = !Number.isNaN(endTime.getTime()) && endTime.getTime() < now.getTime();

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              {allocation.name}
            </h1>
            <StatusBadge
              variant={statusBadgeVariantFromAllocationStatus(allocation.status)}
              label={allocation.status}
            />
            {isExpired && allocation.status === "ACTIVE" ? (
              <StatusBadge variant="expired" label="Past end date" />
            ) : null}
          </div>
          <div className="text-sm text-muted-foreground">
            Project <span className="font-medium text-foreground">{allocation.project_id}</span>
            <span className="mx-2">·</span>
            Cluster <span className="font-medium text-foreground">{allocation.compute_cluster_id}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatDate(allocation.start_time)} → {formatDate(allocation.end_time)}
          </div>
        </div>

        <div className="w-full max-w-md space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Remaining SUs</div>
          <div className="font-heading text-3xl font-semibold text-foreground">
            {formatSU(remaining)}
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              of {formatSU(allocation.initial_su_amount)}
            </span>
          </div>
          <UsageBar
            value={used}
            max={allocation.initial_su_amount}
            label={`Used ${formatSU(used)} SUs`}
          />
        </div>
      </div>
    </div>
  );
}
