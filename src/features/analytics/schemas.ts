import { z } from "zod";

// Zod placeholders only — fleshed out in A1–A3 when API shapes settle.

export const analyticsRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  preset: z.enum(["24h", "7d", "30d", "90d", "custom"]),
});

export const kpiValueSchema = z.object({
  title: z.string(),
  value: z.union([z.number(), z.string()]),
  delta: z
    .object({
      value: z.number(),
      unit: z.string().optional(),
      direction: z.enum(["up", "down"]),
    })
    .optional(),
  deltaTone: z.enum(["positive", "negative", "neutral"]).optional(),
  sparkline: z.array(z.number()).optional(),
});

export const analyticsDashboardSchema = z.object({
  persona: z.enum(["admin", "pi", "researcher"]),
  range: analyticsRangeSchema,
  syncedAt: z.string(),
  kpis: z.array(kpiValueSchema),
});

// --- A1: jobs + queue wait-time (MSW-backed; docs/backend-contracts/analytics.md) ---

export const jobStatusSchema = z.enum(["COMPLETED", "RUNNING", "FAILED", "CANCELLED"]);

export const jobSchema = z.object({
  job_id: z.string(),
  user_id: z.string(),
  allocation_id: z.string(),
  resource_id: z.string(),
  started_at: z.string(),
  su_used: z.number(),
  wait_seconds: z.number().int().nonnegative(),
  status: jobStatusSchema,
});

export const jobListSchema = z.array(jobSchema);

export const queueWaitTimeSchema = z.object({
  queue: z.string(),
  avg_wait_seconds: z.number().int().nonnegative(),
  p50: z.number().int().nonnegative(),
  p90: z.number().int().nonnegative(),
  sample_size: z.number().int().nonnegative(),
});

export const queueWaitTimeListSchema = z.array(queueWaitTimeSchema);

export type Job = z.infer<typeof jobSchema>;
export type JobStatus = z.infer<typeof jobStatusSchema>;
export type QueueWaitTime = z.infer<typeof queueWaitTimeSchema>;
