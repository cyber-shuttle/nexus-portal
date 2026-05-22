"use client";

import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { getAllocationResources } from "@features/allocations/api";
import { useAllocations } from "@features/allocations/queries";
import { allocationKeys } from "@features/allocations/queries";
import {
  type CreditTransferResource,
  CreditTransferWizard,
} from "@features/tools/components/CreditTransferWizard";
import { useAbility } from "@shared/casl/AbilityProvider";
import { useQueries } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import * as React from "react";

export function CreditTransferContainer() {
  const { data: session } = useSession();
  const ability = useAbility();
  const userId = session?.user?.id ?? "";
  const allowed = ability.can("transfer", "Allocation");

  // Phase 4 scope: PI's own allocations. The full member view comes in Phase 7.
  const allocationIds = React.useMemo(
    () => (allowed ? (session?.user?.myPiAllocations ?? []) : []),
    [allowed, session?.user?.myPiAllocations],
  );
  const allocationsQuery = useAllocations(allocationIds);
  const allocations = allocationsQuery.data ?? [];

  const usageQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: ["usage", "total", a.id] as const,
      queryFn: async () => {
        const res = await fetch(`/api/v1/compute-allocations/${a.id}/usages/total`);
        if (!res.ok) throw new Error("Failed to load usage");
        return (await res.json()) as { total_su_amount: number };
      },
      enabled: Boolean(a.id),
    })),
  });

  const resourceQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: allocationKeys.resources(a.id),
      queryFn: () => getAllocationResources(a.id),
      enabled: Boolean(a.id),
    })),
  });

  if (!allowed) {
    return (
      <ErrorState
        heading="Not permitted"
        message="Only PIs and admins can transfer credits between allocations."
      />
    );
  }

  if (allocationIds.length === 0) {
    return (
      <EmptyState
        heading="No allocations to transfer between"
        description="You need to be a PI on at least two allocations to move credits between them."
      />
    );
  }

  const isLoading =
    allocationsQuery.isLoading ||
    usageQueries.some((q) => q.isLoading) ||
    resourceQueries.some((q) => q.isLoading);

  if (isLoading) return <CenteredSpinner label="Loading allocations" />;

  const queryError =
    allocationsQuery.error ??
    usageQueries.find((q) => q.error)?.error ??
    resourceQueries.find((q) => q.error)?.error;
  if (queryError) {
    return (
      <ErrorState
        message={(queryError as Error).message ?? "Failed to load allocations"}
        onRetry={() => {
          for (const q of usageQueries) q.refetch();
          for (const q of resourceQueries) q.refetch();
        }}
      />
    );
  }

  const transferable = allocations.map((a, i) => {
    const used = usageQueries[i]?.data?.total_su_amount ?? 0;
    const remaining = Math.max(0, a.initial_su_amount - used);
    return {
      id: a.id,
      name: a.name,
      status: a.status,
      remaining_su: remaining,
      used_su: used,
    };
  });

  const resourcesByAllocation: Record<string, CreditTransferResource[]> = {};
  for (let i = 0; i < allocations.length; i += 1) {
    const a = allocations[i];
    if (!a) continue;
    resourcesByAllocation[a.id] = (resourceQueries[i]?.data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      resource_type: r.resource_type,
    }));
  }

  return (
    <CreditTransferWizard
      transferableAllocations={transferable}
      resourcesByAllocation={resourcesByAllocation}
      transferredBy={userId}
    />
  );
}
