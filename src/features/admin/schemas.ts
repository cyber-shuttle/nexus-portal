import { z } from "zod";

// Cluster status — spec §8 B4 introduces a status column on
// `compute_clusters`. We mirror the backend's `VARCHAR(16) NOT NULL DEFAULT
// 'ENABLED'` migration verbatim. `DISABLED` hides the cluster from new
// allocation selectors but never breaks existing allocations or in-flight
// jobs (see spec §5.4 cluster filter propagation).
export const clusterStatusSchema = z.enum(["ENABLED", "DISABLED"]);
export type ClusterStatus = z.infer<typeof clusterStatusSchema>;

// Admin-facing cluster row. The portal-wide `ComputeCluster` schema
// (features/allocations/schemas.ts) is intentionally tiny ({id, name}) so it
// can be shared by selectors that don't care about status. This extended
// shape is used by the admin Clusters tab table only.
export const clusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: clusterStatusSchema,
  type: z.string().optional(),
  location: z.string().optional(),
  allocation_count: z.number().int().nonnegative(),
  user_count: z.number().int().nonnegative(),
  inflight_jobs: z.number().int().nonnegative().optional(),
});
export type Cluster = z.infer<typeof clusterSchema>;

export const updateClusterStatusPayloadSchema = z.object({
  status: clusterStatusSchema,
});
export type UpdateClusterStatusPayload = z.infer<typeof updateClusterStatusPayloadSchema>;

export const adminAllocationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]),
});
export type AdminAllocationSummary = z.infer<typeof adminAllocationSummarySchema>;

export const adminStatsSchema = z.object({
  total_projects: z.number(),
  active_allocations: z.number(),
  total_su_allocated_quarter: z.number(),
  total_su_charged_quarter: z.number(),
  pending_proposals: z.number(),
  amie_failed_24h: z.number(),
  allocations_by_day: z.array(z.object({ date: z.string(), count: z.number() })),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

export const adminResourceRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource_type: z.string(),
  cluster_id: z.string(),
  cluster_name: z.string(),
  allocation_count: z.number().int().nonnegative(),
  total_allocated_su: z.number().int().nonnegative(),
  total_used_su: z.number().int().nonnegative(),
  // Accounting can lag and report used_pct > 100 transiently; back-end values
  // are not pre-clamped. The UI clips the UsageBar visually but surfaces the
  // raw figure in the tooltip. Cap at 500 to still reject obviously-broken
  // data (e.g. negative SUs producing absurd ratios).
  used_pct: z.number().min(0).max(500),
  rate_count: z.number().int().nonnegative(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});
export type AdminResourceRow = z.infer<typeof adminResourceRowSchema>;

export const adminResourceUsagePointSchema = z.object({
  date: z.string(),
  used_su: z.number().nonnegative(),
});
export type AdminResourceUsagePoint = z.infer<typeof adminResourceUsagePointSchema>;

export const adminRateRowSchema = z.object({
  id: z.string(),
  compute_allocation_resource_id: z.string(),
  resource_name: z.string(),
  cluster_name: z.string(),
  rate: z.number().positive(),
  effective_from: z.string(),
  effective_to: z.string(),
  active: z.boolean(),
});
export type AdminRateRow = z.infer<typeof adminRateRowSchema>;

export const createRatePayloadSchema = z.object({
  compute_allocation_resource_id: z.string().min(1),
  rate: z.number().positive(),
  effective_from: z.string().min(1),
  effective_to: z.string().min(1),
});
export type CreateRatePayload = z.infer<typeof createRatePayloadSchema>;

export const unmappedJobSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  username: z.string(),
  cluster: z.string(),
  walltime_seconds: z.number().int().nonnegative(),
  su_charged: z.number().int().nonnegative(),
  reason: z.string(),
  raw_data: z.record(z.string(), z.unknown()),
  observed_at: z.string(),
});
export type UnmappedJob = z.infer<typeof unmappedJobSchema>;

export const linkUnmappedJobPayloadSchema = z.object({
  allocation_id: z.string().min(1),
});

export const discardUnmappedJobPayloadSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const adjustmentTypeSchema = z.enum(["CREDIT", "DEBIT", "EXPIRE"]);
export type AdjustmentType = z.infer<typeof adjustmentTypeSchema>;

export const adjustmentSchema = z.object({
  id: z.string(),
  allocation_id: z.string(),
  allocation_name: z.string(),
  type: adjustmentTypeSchema,
  amount: z.number().int().positive(),
  reason: z.string(),
  created_by: z.string(),
  created_at: z.string(),
});
export type Adjustment = z.infer<typeof adjustmentSchema>;

export const createAdjustmentPayloadSchema = z.object({
  allocation_id: z.string().min(1),
  type: adjustmentTypeSchema,
  amount: z.number().int().positive(),
  reason: z.string().min(3).max(500),
});
export type CreateAdjustmentPayload = z.infer<typeof createAdjustmentPayloadSchema>;
