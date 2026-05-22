import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type ComputeAllocation,
  type Project,
  computeAllocationSchema,
  projectSchema,
} from "./schemas";

export async function getProject(id: string): Promise<Project> {
  const raw = await apiFetch(`/projects/${id}`);
  return projectSchema.parse(raw);
}

export async function searchProjects(q: string, limit = 20): Promise<Project[]> {
  if (!q.trim()) return [];
  const search = new URLSearchParams({ q: q.trim(), limit: String(limit) });
  const raw = await apiFetch(`/projects?${search.toString()}`);
  return z.array(projectSchema).parse(raw ?? []);
}

export async function getProjectsAsPi(userId: string): Promise<Project[]> {
  const raw = await apiFetch(`/users/${userId}/projects-as-pi`);
  return z.array(projectSchema).parse(raw ?? []);
}

export async function getProjectComputeAllocations(
  projectId: string,
): Promise<ComputeAllocation[]> {
  const raw = await apiFetch(`/projects/${projectId}/compute-allocations`);
  return z.array(computeAllocationSchema).parse(raw ?? []);
}
