import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type CreateProposalPayload,
  type ProposalDecisionPayload,
  type UpdateProposalPayload,
  createProposalPayloadSchema,
  proposalDecisionPayloadSchema,
  proposalSchema,
  updateProposalPayloadSchema,
} from "./schemas";
import type { Proposal, ProposalListParams } from "./types";

function toQuery(params: ProposalListParams): string {
  const search = new URLSearchParams();
  if (params.status) {
    const v = Array.isArray(params.status) ? params.status.join(",") : params.status;
    search.set("status", v);
  }
  if (params.project_id) search.set("project_id", params.project_id);
  if (params.requester_id) search.set("requester_id", params.requester_id);
  if (params.q) search.set("q", params.q);
  if (params.limit) search.set("limit", String(params.limit));
  if (params.offset) search.set("offset", String(params.offset));
  return search.toString();
}

export async function listProposals(params: ProposalListParams = {}): Promise<Proposal[]> {
  const q = toQuery(params);
  const raw = await apiFetch(`/proposals${q ? `?${q}` : ""}`);
  return z.array(proposalSchema).parse(raw ?? []);
}

export async function getProposal(id: string): Promise<Proposal> {
  const raw = await apiFetch(`/proposals/${id}`);
  return proposalSchema.parse(raw);
}

export async function createProposal(payload: CreateProposalPayload): Promise<Proposal> {
  const parsed = createProposalPayloadSchema.parse(payload);
  const raw = await apiFetch("/proposals", { method: "POST", body: parsed });
  return proposalSchema.parse(raw);
}

export async function updateProposal(id: string, patch: UpdateProposalPayload): Promise<Proposal> {
  const parsed = updateProposalPayloadSchema.parse(patch);
  const raw = await apiFetch(`/proposals/${id}`, { method: "PUT", body: parsed });
  return proposalSchema.parse(raw);
}

export async function approveProposal(
  id: string,
  decision: ProposalDecisionPayload,
): Promise<Proposal> {
  const parsed = proposalDecisionPayloadSchema.parse(decision);
  const raw = await apiFetch(`/proposals/${id}/approve`, { method: "POST", body: parsed });
  return proposalSchema.parse(raw);
}

export async function denyProposal(
  id: string,
  decision: ProposalDecisionPayload,
): Promise<Proposal> {
  const parsed = proposalDecisionPayloadSchema.parse(decision);
  const raw = await apiFetch(`/proposals/${id}/deny`, { method: "POST", body: parsed });
  return proposalSchema.parse(raw);
}

export async function withdrawProposal(id: string, requesterId: string): Promise<Proposal> {
  const raw = await apiFetch(`/proposals/${id}/withdraw`, {
    method: "POST",
    body: { requester_id: requesterId },
  });
  return proposalSchema.parse(raw);
}
