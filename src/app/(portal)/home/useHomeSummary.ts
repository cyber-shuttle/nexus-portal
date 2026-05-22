"use client";

import * as React from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMembershipsForUser, memberKeys } from "@features/members/queries";
import { allocationKeys } from "@features/allocations/queries";
import { getAllocation } from "@features/allocations/api";
import { usageKeys } from "@features/usage/queries";
import { getAllocationUsages } from "@features/usage/api";
import {
  useChangeRequestsForUser,
} from "@features/change-requests/queries";
import { auditKeys } from "@features/audit/queries";
import { getAllocationDiffs } from "@features/audit/api";
import { aggregateHomeSummary } from "@features/home/aggregator";
import type { HomeSummary } from "@features/home/types";

const HOME_USAGE_LIMIT = 1000;

export function useHomeSummary(userId: string | undefined): {
  data: HomeSummary | undefined;
  isLoading: boolean;
  error: Error | null;
} {
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

  // touch keys for biome — they're referenced for cache key normalization upstream
  void memberKeys;

  const data = React.useMemo<HomeSummary | undefined>(() => {
    if (allocations.length === 0 && allocationIds.length > 0) return undefined;
    const usagesByAllocation = new Map<string, Array<{
      compute_allocation_id: string;
      compute_allocation_resource_id: string;
      used_su_amount: number;
      last_updated: string;
    }>>();
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

  return { data, isLoading, error };
}
