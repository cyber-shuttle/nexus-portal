"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import { computeAllocationChangeRequestSchema } from "@shared/api/domain";
import { buildAuditTimeline } from "@shared/api/audit-orchestrator";
import type { AdminHomeSummary } from "@features/home/types";

const adminStatsSchema = z.object({
  total_projects: z.number(),
  active_allocations: z.number(),
  total_su_allocated_quarter: z.number(),
  total_su_charged_quarter: z.number(),
  pending_proposals: z.number(),
  amie_failed_24h: z.number(),
  allocations_by_day: z.array(z.object({ date: z.string(), count: z.number() })),
});
type AdminStats = z.infer<typeof adminStatsSchema>;

async function getAdminStats(): Promise<AdminStats> {
  const raw = await apiFetch("/admin/stats");
  return adminStatsSchema.parse(raw);
}

async function getAdminPendingChangeRequests() {
  const raw = await apiFetch("/admin/change-requests");
  return z.array(computeAllocationChangeRequestSchema).parse(raw ?? []);
}

export type AdminHomeResult = {
  data: AdminHomeSummary | undefined;
  isLoading: boolean;
  error: Error | null;
};

export function useAdminHomeSummary(): AdminHomeResult {
  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: getAdminStats,
  });
  const crQuery = useQuery({
    queryKey: ["admin", "pending-crs"],
    queryFn: getAdminPendingChangeRequests,
  });

  const data = React.useMemo<AdminHomeSummary | undefined>(() => {
    if (!statsQuery.data) return undefined;
    const crs = crQuery.data ?? [];
    const recent = buildAuditTimeline([], crs.map((r) => ({ request: r, events: [] }))).slice(0, 20);
    return {
      total_projects: statsQuery.data.total_projects,
      active_allocations: statsQuery.data.active_allocations,
      total_su_allocated_quarter: statsQuery.data.total_su_allocated_quarter,
      total_su_charged_quarter: statsQuery.data.total_su_charged_quarter,
      pending_proposals: statsQuery.data.pending_proposals,
      amie_failed_24h: statsQuery.data.amie_failed_24h,
      allocations_by_day: statsQuery.data.allocations_by_day,
      allocations: { active: [], expiring_soon: [], recently_active: [] },
      usage: {
        last_30d_su: statsQuery.data.total_su_charged_quarter,
        last_30d_breakdown: [],
      },
      pending_change_requests: crs,
      recent_activity: recent,
    };
  }, [statsQuery.data, crQuery.data]);

  return {
    data,
    isLoading: statsQuery.isLoading || crQuery.isLoading,
    error: (statsQuery.error as Error | null) ?? (crQuery.error as Error | null),
  };
}
