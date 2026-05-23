import {
  type AllocationStatus,
  type ComputeAllocation,
  allocationStatusSchema,
  computeAllocationSchema,
} from "@shared/api/domain";
import { z } from "zod";

export { allocationStatusSchema, computeAllocationSchema };
export type { AllocationStatus, ComputeAllocation };

// Cluster status — spec §8 B4 introduces a status column on
// `compute_clusters`. We mirror the backend's `VARCHAR(16) NOT NULL DEFAULT
// 'ENABLED'` migration verbatim. `DISABLED` hides the cluster from new
// allocation selectors but never breaks existing allocations or in-flight
// jobs (see spec §5.4 cluster filter propagation). Clusters live under the
// allocations feature module (TF0 architect carry-over) because they are an
// allocations-domain concept — features outside admin must NOT import from
// `@features/admin` (§5 isolation).
export const clusterStatusSchema = z.enum(["ENABLED", "DISABLED"]);
export type ClusterStatus = z.infer<typeof clusterStatusSchema>;

// Admin-facing cluster row. The portal-wide `ComputeCluster` schema below is
// intentionally tiny ({id, name, status?}) so it can be shared by selectors
// that don't care about counts. This extended shape is used by the admin
// Clusters tab table only.
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

export const computeAllocationResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  resource_type: z.string(),
  resource_amount: z.number().int(),
});

export const computeAllocationResourceMappingSchema = z.object({
  id: z.string(),
  compute_allocation_id: z.string(),
  compute_allocation_resource_id: z.string(),
  resource_amount: z.number().int(),
  resource_time: z.number().int(),
});

export const computeAllocationResourceRateSchema = z.object({
  id: z.string(),
  compute_allocation_resource_id: z.string(),
  rate: z.number(),
  start_time: z.string(),
  end_time: z.string(),
});

export const computeClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  // Spec §8 B4 migration adds compute_clusters.status. We model it as
  // optional on the shared schema so existing selector consumers that read
  // {id, name} aren't forced to handle the new field; `clusterSchema` above
  // narrows it to required for the admin Clusters tab.
  status: clusterStatusSchema.optional(),
});

export type ComputeAllocationResource = z.infer<typeof computeAllocationResourceSchema>;
export type ComputeAllocationResourceMapping = z.infer<
  typeof computeAllocationResourceMappingSchema
>;
export type ComputeAllocationResourceRate = z.infer<typeof computeAllocationResourceRateSchema>;
export type ComputeCluster = z.infer<typeof computeClusterSchema>;
