"use client";

import { useQuery } from "@tanstack/react-query";
import { type JobsListParams, type QueueWaitTimeParams, getJobs, getQueueWaitTimes } from "./api";
import type { AnalyticsRange } from "./types";

// Stable query-key factory for analytics. Date range goes into the key so
// TanStack auto-refetches on URL-state change (spec §5.3).
export const analyticsKeys = {
  all: ["analytics"] as const,
  range: (params: AnalyticsRange) => [...analyticsKeys.all, "range", params] as const,
  jobs: (params: JobsListParams) => [...analyticsKeys.all, "jobs", params] as const,
  queueWaitTimes: (params: QueueWaitTimeParams) =>
    [...analyticsKeys.all, "queue-wait-times", params] as const,
};

export function useJobs(params: JobsListParams) {
  return useQuery({
    queryKey: analyticsKeys.jobs(params),
    queryFn: () => getJobs(params),
  });
}

export function useQueueWaitTimes(params: QueueWaitTimeParams) {
  return useQuery({
    queryKey: analyticsKeys.queueWaitTimes(params),
    queryFn: () => getQueueWaitTimes(params),
  });
}
