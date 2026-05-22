import { apiFetch } from "@shared/api/client";
import {
  type ComputeAllocationChangeRequest,
  computeAllocationChangeRequestSchema,
} from "@shared/api/domain";
import { z } from "zod";
import {
  type AdjustmentType,
  type AdminAllocationSummary,
  type AdminRateRow,
  type AdminResourceRow,
  type AdminResourceUsagePoint,
  type AdminStats,
  type Adjustment,
  type CreateAdjustmentPayload,
  type CreateRatePayload,
  type UnmappedJob,
  adjustmentSchema,
  adminAllocationSummarySchema,
  adminRateRowSchema,
  adminResourceRowSchema,
  adminResourceUsagePointSchema,
  adminStatsSchema,
  createAdjustmentPayloadSchema,
  createRatePayloadSchema,
  discardUnmappedJobPayloadSchema,
  linkUnmappedJobPayloadSchema,
  unmappedJobSchema,
} from "./schemas";

export async function getAdminStats(): Promise<AdminStats> {
  const raw = await apiFetch("/admin/stats");
  return adminStatsSchema.parse(raw);
}

export type AdminChangeRequestsParams = {
  status?: string;
  limit?: number;
};

export async function getAdminChangeRequests(
  params: AdminChangeRequestsParams = {},
): Promise<ComputeAllocationChangeRequest[]> {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  const qs = search.toString();
  const raw = await apiFetch(`/admin/change-requests${qs ? `?${qs}` : ""}`);
  return z.array(computeAllocationChangeRequestSchema).parse(raw ?? []);
}

export type AdminResourcesParams = {
  cluster?: string;
  status?: string;
  q?: string;
};

export async function getAdminResources(
  params: AdminResourcesParams = {},
): Promise<AdminResourceRow[]> {
  const search = new URLSearchParams();
  if (params.cluster) search.set("cluster", params.cluster);
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  const raw = await apiFetch(`/admin/resources${qs ? `?${qs}` : ""}`);
  return z.array(adminResourceRowSchema).parse(raw ?? []);
}

export async function getAdminResourceTrend(id: string): Promise<AdminResourceUsagePoint[]> {
  const raw = await apiFetch(`/admin/resources/${encodeURIComponent(id)}/usage-trend`);
  return z.array(adminResourceUsagePointSchema).parse(raw ?? []);
}

export async function getAdminRates(): Promise<AdminRateRow[]> {
  const raw = await apiFetch("/admin/rates");
  return z.array(adminRateRowSchema).parse(raw ?? []);
}

export async function createAdminRate(payload: CreateRatePayload): Promise<AdminRateRow> {
  const validated = createRatePayloadSchema.parse(payload);
  const raw = await apiFetch("/admin/rates", {
    method: "POST",
    body: validated,
  });
  return adminRateRowSchema.parse(raw);
}

export async function deactivateAdminRate(id: string): Promise<AdminRateRow> {
  const raw = await apiFetch(`/admin/rates/${encodeURIComponent(id)}/deactivate`, {
    method: "POST",
  });
  return adminRateRowSchema.parse(raw);
}

export type AdminAllocationsParams = {
  q?: string;
  status?: "ACTIVE" | "INACTIVE";
  limit?: number;
};

export async function getAdminAllocations(
  params: AdminAllocationsParams = {},
): Promise<AdminAllocationSummary[]> {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  const qs = search.toString();
  const raw = await apiFetch(`/admin/allocations${qs ? `?${qs}` : ""}`);
  return z.array(adminAllocationSummarySchema).parse(raw ?? []);
}

export async function getUnmappedJobs(): Promise<UnmappedJob[]> {
  const raw = await apiFetch("/admin/unmapped-jobs");
  return z.array(unmappedJobSchema).parse(raw ?? []);
}

export async function linkUnmappedJob(id: string, allocation_id: string): Promise<UnmappedJob> {
  const validated = linkUnmappedJobPayloadSchema.parse({ allocation_id });
  const raw = await apiFetch(`/admin/unmapped-jobs/${encodeURIComponent(id)}/link`, {
    method: "POST",
    body: validated,
  });
  return unmappedJobSchema.parse(raw);
}

export async function discardUnmappedJob(id: string, reason: string): Promise<{ ok: true }> {
  const validated = discardUnmappedJobPayloadSchema.parse({ reason });
  await apiFetch(`/admin/unmapped-jobs/${encodeURIComponent(id)}/discard`, {
    method: "POST",
    body: validated,
  });
  return { ok: true };
}

export type AdjustmentsParams = {
  type?: AdjustmentType | "all";
  allocation_id?: string;
};

export async function getAdjustments(params: AdjustmentsParams = {}): Promise<Adjustment[]> {
  const search = new URLSearchParams();
  if (params.type && params.type !== "all") search.set("type", params.type);
  if (params.allocation_id) search.set("allocation_id", params.allocation_id);
  const qs = search.toString();
  const raw = await apiFetch(`/admin/adjustments${qs ? `?${qs}` : ""}`);
  return z.array(adjustmentSchema).parse(raw ?? []);
}

export async function createAdjustment(payload: CreateAdjustmentPayload): Promise<Adjustment> {
  const validated = createAdjustmentPayloadSchema.parse(payload);
  const raw = await apiFetch("/admin/adjustments", {
    method: "POST",
    body: validated,
  });
  return adjustmentSchema.parse(raw);
}
