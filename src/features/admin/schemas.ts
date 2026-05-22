import { z } from "zod";

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
