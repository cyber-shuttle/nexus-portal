import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import { computeAllocationDiffSchema, type ComputeAllocationDiff } from "@shared/api/domain";

export { buildAuditTimeline } from "@shared/api/audit-orchestrator";

export async function getAllocationDiffs(allocId: string): Promise<ComputeAllocationDiff[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/diffs`);
  return z.array(computeAllocationDiffSchema).parse(raw ?? []);
}
