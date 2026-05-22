"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { useAllocationDiffs } from "@features/audit/queries";
import {
  useChangeRequestsForAllocation,
  changeRequestKeys,
} from "@features/change-requests/queries";
import { getChangeRequestEvents } from "@features/change-requests/api";
import { buildAuditTimeline } from "@shared/api/audit-orchestrator";
import { AuditTab } from "@features/audit/components/AuditTab";

export function AuditTabContainer({ allocationId }: { allocationId: string }) {
  const diffsQuery = useAllocationDiffs(allocationId);
  const requestsQuery = useChangeRequestsForAllocation(allocationId);
  const requests = requestsQuery.data ?? [];

  const eventQueries = useQueries({
    queries: requests.map((r) => ({
      queryKey: changeRequestKeys.events(r.id),
      queryFn: () => getChangeRequestEvents(r.id),
      enabled: Boolean(r.id),
    })),
  });

  const requestsWithEvents = React.useMemo(
    () =>
      requests.map((request, i) => ({
        request,
        events: eventQueries[i]?.data ?? [],
      })),
    [requests, eventQueries],
  );

  const events = React.useMemo(
    () => buildAuditTimeline(diffsQuery.data ?? [], requestsWithEvents),
    [diffsQuery.data, requestsWithEvents],
  );

  const isLoading =
    diffsQuery.isLoading || requestsQuery.isLoading || eventQueries.some((q) => q.isLoading);
  const error =
    (diffsQuery.error as Error | null) ??
    (requestsQuery.error as Error | null) ??
    (eventQueries.find((q) => q.error)?.error as Error | undefined) ??
    null;

  return (
    <AuditTab
      events={events}
      isLoading={isLoading}
      error={error}
      onRetry={() => {
        diffsQuery.refetch();
        requestsQuery.refetch();
      }}
    />
  );
}
