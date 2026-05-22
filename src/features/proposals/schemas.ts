import { z } from "zod";
import { PROPOSAL_STATUSES } from "./types";

export const proposalStatusSchema = z.enum(PROPOSAL_STATUSES);

export const proposalResourceRequestSchema = z.object({
  resource_id: z.string().min(1),
  resource_name: z.string().min(1),
  resource_type: z.string().min(1),
  requested_su_amount: z.number().int().nonnegative(),
});

export const proposalChildAllocationRequestSchema = z.object({
  project_id: z.string().min(1),
  project_title: z.string().min(1),
  su_split_percent: z.number().min(0).max(100),
});

export const proposalDecisionSchema = z.object({
  decided_by: z.string().min(1),
  decided_at: z.string().min(1),
  decision_note: z.string().optional(),
});

export const proposalSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  project_title: z.string(),
  requester_id: z.string(),
  title: z.string(),
  abstract: z.string(),
  justification: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  resources: z.array(proposalResourceRequestSchema),
  cascade_to_sub_projects: z.boolean(),
  child_allocations: z.array(proposalChildAllocationRequestSchema),
  status: proposalStatusSchema,
  decision: proposalDecisionSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const createProposalPayloadSchema = z.object({
  project_id: z.string().min(1),
  project_title: z.string().min(1),
  requester_id: z.string().min(1),
  title: z.string().min(3).max(160),
  abstract: z.string().min(40).max(1200),
  justification: z.string().min(500).max(2000),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  resources: z.array(proposalResourceRequestSchema).min(1),
  cascade_to_sub_projects: z.boolean().default(false),
  child_allocations: z.array(proposalChildAllocationRequestSchema).default([]),
  status: z.enum(["DRAFT", "SUBMITTED"]).default("SUBMITTED"),
});

export type CreateProposalPayload = z.infer<typeof createProposalPayloadSchema>;

export const updateProposalPayloadSchema = createProposalPayloadSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "patch is empty" });

export type UpdateProposalPayload = z.infer<typeof updateProposalPayloadSchema>;

export const proposalDecisionPayloadSchema = z.object({
  decided_by: z.string().min(1),
  decision_note: z.string().max(2000).optional(),
});

export type ProposalDecisionPayload = z.infer<typeof proposalDecisionPayloadSchema>;
