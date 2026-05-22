"use client";

import { getAllocationResources } from "@features/allocations/api";
import {
  type AllocationRow,
  AllocationsList,
} from "@features/allocations/components/AllocationsList";
import { allocationKeys, useAllocations } from "@features/allocations/queries";
import { getMembershipsForAllocation } from "@features/members/api";
import { memberKeys, useMembershipsForUser } from "@features/members/queries";
import { getAllocationUsageTotal } from "@features/usage/api";
import { usageKeys } from "@features/usage/queries";
import { useQueries } from "@tanstack/react-query";
import * as React from "react";

export function AllocationsListContainer({ userId }: { userId: string }) {
  const membershipsQuery = useMembershipsForUser(userId);
  const memberships = membershipsQuery.data ?? [];
  const allocationIds = React.useMemo(
    () => Array.from(new Set(memberships.map((m) => m.compute_allocation_id))),
    [memberships],
  );

  const allocationsResult = useAllocations(allocationIds);
  const allocations = allocationsResult.data;

  const auxQueries = useQueries({
    queries: allocations.flatMap((a) => [
      {
        queryKey: usageKeys.total(a.id),
        queryFn: () => getAllocationUsageTotal(a.id),
        enabled: true,
      },
      {
        queryKey: memberKeys.forAllocation(a.id),
        queryFn: () => getMembershipsForAllocation(a.id),
        enabled: true,
      },
      {
        queryKey: allocationKeys.resources(a.id),
        queryFn: () => getAllocationResources(a.id),
        enabled: true,
      },
    ]),
  });

  const rows: AllocationRow[] = allocations.map((allocation, i) => {
    const baseIndex = i * 3;
    const total = auxQueries[baseIndex]?.data as { total_su_amount?: number } | undefined;
    const members = (auxQueries[baseIndex + 1]?.data ?? []) as Array<unknown>;
    const resources = (auxQueries[baseIndex + 2]?.data ?? []) as Array<{
      name: string;
      resource_type: string;
    }>;
    const resourceSummary = resources.length
      ? resources.map((r) => `${r.name} (${r.resource_type})`).join(", ")
      : "—";
    return {
      allocation,
      used: total?.total_su_amount ?? 0,
      members: members.length,
      resourceSummary,
    };
  });

  const isLoading = membershipsQuery.isLoading || allocationsResult.isLoading;
  const error =
    (membershipsQuery.error as Error | null) ?? (allocationsResult.error as Error | null) ?? null;

  return (
    <AllocationsList
      rows={rows}
      isLoading={isLoading}
      error={error}
      onRetry={() => membershipsQuery.refetch()}
    />
  );
}
