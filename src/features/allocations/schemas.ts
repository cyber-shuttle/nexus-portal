import { z } from "zod";
import {
  allocationStatusSchema,
  projectStatusSchema,
  type AllocationStatus,
  type ProjectStatus,
} from "@shared/api/domain";

export { allocationStatusSchema, projectStatusSchema };
export type { AllocationStatus, ProjectStatus };

export const computeAllocationSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  status: allocationStatusSchema,
  compute_cluster_id: z.string(),
  initial_su_amount: z.number().int(),
  start_time: z.string(),
  end_time: z.string(),
});

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

export const projectSchema = z.object({
  id: z.string(),
  originated_id: z.string(),
  title: z.string(),
  origination: z.string(),
  project_pi_id: z.string(),
  status: projectStatusSchema,
  created_time: z.string(),
});

export const computeClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export type ComputeAllocation = z.infer<typeof computeAllocationSchema>;
export type ComputeAllocationResource = z.infer<typeof computeAllocationResourceSchema>;
export type ComputeAllocationResourceMapping = z.infer<typeof computeAllocationResourceMappingSchema>;
export type ComputeAllocationResourceRate = z.infer<typeof computeAllocationResourceRateSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ComputeCluster = z.infer<typeof computeClusterSchema>;
