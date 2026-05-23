import { z } from "zod";

export { projectSchema, projectStatusSchema, computeAllocationSchema } from "@shared/api/domain";
export type { Project, ProjectStatus, ComputeAllocation } from "@shared/api/domain";

import { projectSchema } from "@shared/api/domain";

// Paginated envelope for the new GET /projects?limit&offset&pi_id&status&q
// list endpoint. The Phase 7 autocomplete handler returns a bare array; the
// TF1 list view consumes this paginated shape so the table can render
// "1-20 of 47". Kept envelope-flat (no embedded links) until the backend
// commits to a richer pagination contract.
export const projectListEnvelopeSchema = z.object({
  items: z.array(projectSchema),
  total: z.number().int().nonnegative(),
});
export type ProjectListEnvelope = z.infer<typeof projectListEnvelopeSchema>;

// MSW-only summary used by the project Resource Usage tab + the analytics
// resources callout. Documented in docs/backend-contracts (extended in TF4).
// Keep numbers loosely-bounded: usage can transiently exceed allocated when
// accounting runs lag job completion.
export const projectUsageAllocationRowSchema = z.object({
  allocation_id: z.string(),
  allocation_name: z.string(),
  allocated_su: z.number().nonnegative(),
  used_su: z.number().nonnegative(),
});

export const projectUsageResourceRowSchema = z.object({
  resource_id: z.string(),
  resource_name: z.string(),
  resource_type: z.string(),
  used_su: z.number().nonnegative(),
  used_pct: z.number().min(0).max(500),
});

export const projectUsageMemberRowSchema = z.object({
  user_id: z.string(),
  user_label: z.string(),
  used_su: z.number().nonnegative(),
});

export const projectUsageSummarySchema = z.object({
  project_id: z.string(),
  range: z.object({ from: z.string(), to: z.string() }),
  total_allocated_su: z.number().nonnegative(),
  total_used_su: z.number().nonnegative(),
  allocations: z.array(projectUsageAllocationRowSchema),
  by_resource: z.array(projectUsageResourceRowSchema),
  by_member: z.array(projectUsageMemberRowSchema),
});
export type ProjectUsageSummary = z.infer<typeof projectUsageSummarySchema>;
export type ProjectUsageAllocationRow = z.infer<typeof projectUsageAllocationRowSchema>;
export type ProjectUsageResourceRow = z.infer<typeof projectUsageResourceRowSchema>;
export type ProjectUsageMemberRow = z.infer<typeof projectUsageMemberRowSchema>;

// Mutation payloads — narrowly scoped to what the list/detail surfaces need.
// `originated_id` stays server-assigned for now; we'll relax once the backend
// contract for project creation lands.
export const createProjectPayloadSchema = z.object({
  title: z.string().min(1).max(200),
  origination: z.string().min(1).max(64),
  project_pi_id: z.string().min(1),
});
export type CreateProjectPayload = z.infer<typeof createProjectPayloadSchema>;

export const updateProjectStatusPayloadSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]),
});
export type UpdateProjectStatusPayload = z.infer<typeof updateProjectStatusPayloadSchema>;
