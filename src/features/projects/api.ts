import { z } from "zod";
import { apiFetch } from "@shared/api/client";
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
