import { z } from "zod";
import {
  allocationStatusSchema,
  computeAllocationSchema,
  projectSchema,
  projectStatusSchema,
  type AllocationStatus,
  type ComputeAllocation,
  type Project,
  type ProjectStatus,
} from "@shared/api/domain";

export {
  allocationStatusSchema,
  projectStatusSchema,
  computeAllocationSchema,
  projectSchema,
};
export type { AllocationStatus, ProjectStatus, ComputeAllocation, Project };

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
});

export type ComputeAllocationResource = z.infer<typeof computeAllocationResourceSchema>;
export type ComputeAllocationResourceMapping = z.infer<typeof computeAllocationResourceMappingSchema>;
export type ComputeAllocationResourceRate = z.infer<typeof computeAllocationResourceRateSchema>;
export type ComputeCluster = z.infer<typeof computeClusterSchema>;
