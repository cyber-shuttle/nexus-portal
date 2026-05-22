import { formatSU } from "@/lib/format";
import { EmptyState } from "@/shared/ui/EmptyState";
import { StatusBadge, statusBadgeVariantFromAllocationStatus } from "@/shared/ui/StatusBadge";
import { UsageBar } from "@/shared/ui/UsageBar";
import type { ComputeAllocation } from "@shared/api/domain";
import Link from "next/link";

export type HomeAllocationsListProps = {
  allocations: ComputeAllocation[];
  usedByAllocation: Map<string, number>;
};

export function HomeAllocationsList({ allocations, usedByAllocation }: HomeAllocationsListProps) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-5 py-3">
        <h2 className="font-heading text-base font-semibold">Your allocations</h2>
      </header>
      {allocations.length === 0 ? (
        <div className="p-5">
          <EmptyState
            heading="No active allocations"
            description="Submit a proposal to get started."
          />
        </div>
      ) : (
        <ol className="divide-y">
          {allocations.map((allocation) => {
            const used = usedByAllocation.get(allocation.id) ?? 0;
            return (
              <li key={allocation.id} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/allocations/${allocation.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    {allocation.name}
                  </Link>
                  <StatusBadge
                    variant={statusBadgeVariantFromAllocationStatus(allocation.status)}
                    label={allocation.status}
                  />
                </div>
                <div className="mt-2 flex items-baseline justify-between text-xs text-muted-foreground">
                  <span>
                    {formatSU(used)} / {formatSU(allocation.initial_su_amount)} SUs
                  </span>
                  <span>Ends {new Date(allocation.end_time).toLocaleDateString()}</span>
                </div>
                <UsageBar
                  value={used}
                  max={allocation.initial_su_amount}
                  size="sm"
                  className="mt-1"
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
