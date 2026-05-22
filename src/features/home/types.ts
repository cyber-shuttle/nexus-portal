import type { AuditEvent } from "@shared/api/audit-orchestrator";
import type {
  ComputeAllocation,
  ComputeAllocationChangeRequest,
  Project,
} from "@shared/api/domain";

export type ResourceBreakdown = {
  resource_id: string;
  su: number;
};

export type HomeAllocations = {
  active: ComputeAllocation[];
  expiring_soon: ComputeAllocation[];
  recently_active: ComputeAllocation[];
};

export type HomeUsage = {
  last_30d_su: number;
  last_30d_breakdown: ResourceBreakdown[];
};

export type HomeSummary = {
  allocations: HomeAllocations;
  usage: HomeUsage;
  pending_change_requests: ComputeAllocationChangeRequest[];
  recent_activity: AuditEvent[];
};

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
