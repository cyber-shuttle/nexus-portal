import { apiFetch } from "@shared/api/client";
import {
  type Job,
  type QueueWaitTime,
  jobListSchema,
  queueWaitTimeListSchema,
} from "./schemas";

export type JobsListParams = {
  user_id?: string;
  from?: string;
  to?: string;
  limit?: number;
};

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") search.set(k, String(v));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export async function getJobs(params: JobsListParams = {}): Promise<Job[]> {
  const raw = await apiFetch(`/jobs${buildQuery(params)}`);
  return jobListSchema.parse(raw ?? []);
}

export type QueueWaitTimeParams = {
  from?: string;
  to?: string;
  group_by?: "queue";
};

export async function getQueueWaitTimes(
  params: QueueWaitTimeParams = {},
): Promise<QueueWaitTime[]> {
  const raw = await apiFetch(`/queues/wait-time${buildQuery({ ...params })}`);
  return queueWaitTimeListSchema.parse(raw ?? []);
}
