import { apiFetch } from "@shared/api/client";
import { type ComputeAllocationDiff, computeAllocationDiffSchema } from "@shared/api/domain";
import { z } from "zod";

export { buildAuditTimeline } from "@shared/api/audit-orchestrator";

export async function getAllocationDiffs(allocId: string): Promise<ComputeAllocationDiff[]> {
  const raw = await apiFetch(`/compute-allocations/${allocId}/diffs`);
  return z.array(computeAllocationDiffSchema).parse(raw ?? []);
}
