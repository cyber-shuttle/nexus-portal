"use client";

import { getAllocationDiffs } from "@features/audit/api";
import { AuditTab } from "@features/audit/components/AuditTab";
import { auditKeys } from "@features/audit/queries";
import {
  getChangeRequestEvents,
  getChangeRequestsForAllocation,
} from "@features/change-requests/api";
import { changeRequestKeys } from "@features/change-requests/queries";
import type { ComputeAllocation } from "@features/projects/schemas";
import { buildAuditTimeline } from "@shared/api/audit-orchestrator";
import { useQueries } from "@tanstack/react-query";
import * as React from "react";

// Project audit = the merged timeline across every allocation in the project.
// Reuses the existing AuditTab presentational + audit-orchestrator builder so
// the chrome stays consistent with allocation-scoped audit. The fan-out cost
// is O(allocations) for diffs + O(allocations) for change-requests + O(change-
// requests) for events, which stays well-bounded for a typical project.

export type ProjectAuditTabContainerProps = {
  allocations: ComputeAllocation[];
};

export function ProjectAuditTabContainer({ allocations }: ProjectAuditTabContainerProps) {
  const diffQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: auditKeys.diffs(a.id),
      queryFn: () => getAllocationDiffs(a.id),
      enabled: Boolean(a.id),
    })),
  });

  const requestQueries = useQueries({
    queries: allocations.map((a) => ({
      queryKey: changeRequestKeys.forAllocation(a.id),
      queryFn: () => getChangeRequestsForAllocation(a.id),
      enabled: Boolean(a.id),
    })),
  });

  const allRequests = React.useMemo(
    () => requestQueries.flatMap((q) => q.data ?? []),
    [requestQueries],
  );

  const eventQueries = useQueries({
    queries: allRequests.map((r) => ({
      queryKey: changeRequestKeys.events(r.id),
      queryFn: () => getChangeRequestEvents(r.id),
      enabled: Boolean(r.id),
    })),
  });

  const requestsWithEvents = React.useMemo(
    () =>
      allRequests.map((request, i) => ({
        request,
        events: eventQueries[i]?.data ?? [],
      })),
    [allRequests, eventQueries],
  );

  const allDiffs = React.useMemo(
    () => diffQueries.flatMap((q) => q.data ?? []),
    [diffQueries],
  );

  const events = React.useMemo(
    () => buildAuditTimeline(allDiffs, requestsWithEvents),
    [allDiffs, requestsWithEvents],
  );

  const isLoading =
    diffQueries.some((q) => q.isLoading) ||
    requestQueries.some((q) => q.isLoading) ||
    eventQueries.some((q) => q.isLoading);
  const error =
    (diffQueries.find((q) => q.error)?.error as Error | undefined) ??
    (requestQueries.find((q) => q.error)?.error as Error | undefined) ??
    (eventQueries.find((q) => q.error)?.error as Error | undefined) ??
    null;

  return (
    <AuditTab
      events={events}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        for (const q of diffQueries) q.refetch();
        for (const q of requestQueries) q.refetch();
      }}
    />
  );
}
