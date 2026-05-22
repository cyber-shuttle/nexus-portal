"use client";

import { getAllocation } from "@features/allocations/api";
import { allocationKeys } from "@features/allocations/queries";
import { getAllocationDiffs } from "@features/audit/api";
import { auditKeys } from "@features/audit/queries";
import { useChangeRequestsForUser } from "@features/change-requests/queries";
import { aggregateHomeSummary } from "@shared/api/aggregator";
import type { HomeSummary } from "@features/home/types";
import { useMembershipsForUser } from "@features/members/queries";
import { getAllocationUsages } from "@features/usage/api";
import { usageKeys } from "@features/usage/queries";
import { useQueries } from "@tanstack/react-query";
import * as React from "react";

const HOME_USAGE_LIMIT = 1000;

export type HomeSummaryResult = {
  data: HomeSummary | undefined;
  usedByAllocation: Map<string, number>;
  isLoading: boolean;
  error: Error | null;
};

export function useHomeSummary(userId: string | undefined): HomeSummaryResult {
  const membershipsQuery = useMembershipsForUser(userId);
  const memberships = membershipsQuery.data ?? [];
  const allocationIds = React.useMemo(
    () => Array.from(new Set(memberships.map((m) => m.compute_allocation_id))),
    [memberships],
  );

  const allocationQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: allocationKeys.detail(id),
      queryFn: () => getAllocation(id),
      enabled: true,
    })),
  });
  const allocations = allocationQueries
    .map((q) => q.data)
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const usagesQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: usageKeys.list(id, { limit: HOME_USAGE_LIMIT }),
      queryFn: () => getAllocationUsages(id, { limit: HOME_USAGE_LIMIT }),
      enabled: true,
    })),
  });

  const diffQueries = useQueries({
    queries: allocationIds.map((id) => ({
      queryKey: auditKeys.diffs(id),
      queryFn: () => getAllocationDiffs(id),
      enabled: true,
    })),
  });

  const changeRequestsQuery = useChangeRequestsForUser(userId);

  const usedByAllocation = React.useMemo(() => {
    const map = new Map<string, number>();
    allocationIds.forEach((id, i) => {
      const usages = usagesQueries[i]?.data ?? [];
      const total = usages.reduce((acc, u) => acc + u.used_su_amount, 0);
      map.set(id, total);
    });
    return map;
  }, [allocationIds, usagesQueries]);

  const data = React.useMemo<HomeSummary | undefined>(() => {
    if (allocationIds.length > 0 && allocations.length === 0) return undefined;
    const usagesByAllocation = new Map<
      string,
      Array<{
        compute_allocation_id: string;
        compute_allocation_resource_id: string;
        used_su_amount: number;
        last_updated: string;
      }>
    >();
    allocationIds.forEach((id, i) => {
      usagesByAllocation.set(id, usagesQueries[i]?.data ?? []);
    });
    const diffs = diffQueries.flatMap((q) => q.data ?? []);
    return aggregateHomeSummary({
      allocations,
      usagesByAllocation,
      diffs,
      changeRequests: changeRequestsQuery.data ?? [],
    });
  }, [allocations, allocationIds, usagesQueries, diffQueries, changeRequestsQuery.data]);

  const isLoading =
    membershipsQuery.isLoading ||
    allocationQueries.some((q) => q.isLoading) ||
    usagesQueries.some((q) => q.isLoading) ||
    diffQueries.some((q) => q.isLoading) ||
    changeRequestsQuery.isLoading;

  const error =
    (membershipsQuery.error as Error | null) ??
    (allocationQueries.find((q) => q.error)?.error as Error | undefined) ??
    (usagesQueries.find((q) => q.error)?.error as Error | undefined) ??
    (diffQueries.find((q) => q.error)?.error as Error | undefined) ??
    (changeRequestsQuery.error as Error | null) ??
    null;

  return { data, usedByAllocation, isLoading, error };
}
