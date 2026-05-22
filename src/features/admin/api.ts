import { apiFetch } from "@shared/api/client";
import {
  type ComputeAllocationChangeRequest,
  computeAllocationChangeRequestSchema,
} from "@shared/api/domain";
import { z } from "zod";
import { type AdminStats, adminStatsSchema } from "./schemas";

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
