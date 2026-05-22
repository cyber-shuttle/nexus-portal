import type { AggregatedSummary, ResourceBreakdown } from "@shared/api/aggregator";
import type { Project } from "@shared/api/domain";

// Home dashboards consume the shared aggregator output directly; the type
// aliases below stay for source compatibility with hooks/components.
export type { ResourceBreakdown };
export type HomeAllocations = AggregatedSummary["allocations"];
export type HomeUsage = AggregatedSummary["usage"];
export type HomeSummary = AggregatedSummary;

export type PiHomeSummary = HomeSummary & {
  projects: Array<{
    project: Project;
    allocation_count: number;
    total_su: number;
    used_su: number;
    pending_cr_count: number;
  }>;
};

export type AdminHomeSummary = HomeSummary & {
  total_projects: number;
  active_allocations: number;
  total_su_allocated_quarter: number;
  total_su_charged_quarter: number;
  pending_proposals: number;
  amie_failed_24h: number;
  allocations_by_day: Array<{ date: string; count: number }>;
};
