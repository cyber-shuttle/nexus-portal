import { z } from "zod";

export const computeAllocationUsageSchema = z.object({
  id: z.string(),
  compute_allocation_id: z.string(),
  used_raw_amount: z.number().int(),
  used_su_amount: z.number().int(),
  last_updated: z.string(),
  user_id: z.string(),
  job_id: z.string(),
  compute_allocation_resource_id: z.string(),
});

export const computeAllocationUsageTotalSchema = z.object({
  compute_allocation_id: z.string(),
  total_su_amount: z.number().int(),
});

export const computeAllocationUserUsageTotalSchema = z.object({
  compute_allocation_id: z.string(),
  user_id: z.string(),
  total_su_amount: z.number().int(),
});

export type ComputeAllocationUsage = z.infer<typeof computeAllocationUsageSchema>;
export type ComputeAllocationUsageTotal = z.infer<typeof computeAllocationUsageTotalSchema>;
export type ComputeAllocationUserUsageTotal = z.infer<typeof computeAllocationUserUsageTotalSchema>;
