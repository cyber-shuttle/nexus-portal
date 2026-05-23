import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type ComputeAllocation,
  type CreateProjectPayload,
  type Project,
  type ProjectListEnvelope,
  type ProjectUsageSummary,
  type UpdateProjectStatusPayload,
  computeAllocationSchema,
  createProjectPayloadSchema,
  projectListEnvelopeSchema,
  projectSchema,
  projectUsageSummarySchema,
  updateProjectStatusPayloadSchema,
} from "./schemas";

export async function getProject(id: string): Promise<Project> {
  const raw = await apiFetch(`/projects/${id}`);
  return projectSchema.parse(raw);
}

export async function searchProjects(q: string, limit = 20): Promise<Project[]> {
  if (!q.trim()) return [];
  const search = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  const raw = await apiFetch(`/projects?${search.toString()}`);
  // Search returns a bare array (Phase 7 autocomplete contract). The list
  // envelope wraps it in `{items,total}` and is used by listProjects below.
  return z.array(projectSchema).parse(raw ?? []);
}

export type ListProjectsParams = {
  limit?: number;
  offset?: number;
  pi_id?: string;
  status?: string;
  q?: string;
};

export async function listProjects(params: ListProjectsParams = {}): Promise<ProjectListEnvelope> {
  const search = new URLSearchParams();
  if (typeof params.limit === "number") search.set("limit", String(params.limit));
  if (typeof params.offset === "number") search.set("offset", String(params.offset));
  if (params.pi_id) search.set("pi_id", params.pi_id);
  if (params.status) search.set("status", params.status);
  if (params.q) search.set("q", params.q);
  // Flag the request as a paged list so the MSW handler returns the envelope
  // shape rather than the search-mode bare array. The backend will key on the
  // same param when it ships the real endpoint.
  search.set("paged", "1");
  const qs = search.toString();
  const raw = await apiFetch(`/projects${qs ? `?${qs}` : ""}`);
  return projectListEnvelopeSchema.parse(raw);
}

export async function getProjectsAsPi(userId: string): Promise<Project[]> {
  const raw = await apiFetch(`/users/${userId}/projects-as-pi`);
  return z.array(projectSchema).parse(raw ?? []);
}

// Membership-derived projects: every project the user belongs to (as PI,
// co-PI, or plain member). Backed by GET /users/{id}/projects in MSW until
// the backend ships the real endpoint per spec §8 B2.
export async function getProjectsForUser(userId: string): Promise<Project[]> {
  const raw = await apiFetch(`/users/${userId}/projects`);
  return z.array(projectSchema).parse(raw ?? []);
}

export async function getProjectComputeAllocations(
  projectId: string,
): Promise<ComputeAllocation[]> {
  const raw = await apiFetch(`/projects/${projectId}/compute-allocations`);
  return z.array(computeAllocationSchema).parse(raw ?? []);
}

export type ProjectUsageRange = { from: string; to: string };

export async function getProjectUsageSummary(
  id: string,
  range: ProjectUsageRange,
): Promise<ProjectUsageSummary> {
  const search = new URLSearchParams({ from: range.from, to: range.to });
  const raw = await apiFetch(`/projects/${id}/usage-summary?${search.toString()}`);
  return projectUsageSummarySchema.parse(raw);
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const validated = createProjectPayloadSchema.parse(payload);
  const raw = await apiFetch("/projects", { method: "POST", body: validated });
  return projectSchema.parse(raw);
}

export async function updateProjectStatus(
  id: string,
  payload: UpdateProjectStatusPayload,
): Promise<Project> {
  const validated = updateProjectStatusPayloadSchema.parse(payload);
  const raw = await apiFetch(`/projects/${id}/status`, { method: "PUT", body: validated });
  return projectSchema.parse(raw);
}
