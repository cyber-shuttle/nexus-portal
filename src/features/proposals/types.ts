export const PROPOSAL_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "DENIED",
  "WITHDRAWN",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type ProposalResourceRequest = {
  resource_id: string;
  resource_name: string;
  resource_type: string;
  requested_su_amount: number;
};

export type ProposalChildAllocationRequest = {
  project_id: string;
  project_title: string;
  su_split_percent: number;
};

export type ProposalDecision = {
  decided_by: string;
  decided_at: string;
  decision_note?: string;
};

export type Proposal = {
  id: string;
  project_id: string;
  project_title: string;
  requester_id: string;
  title: string;
  abstract: string;
  justification: string;
  start_date: string;
  end_date: string;
  resources: ProposalResourceRequest[];
  cascade_to_sub_projects: boolean;
  child_allocations: ProposalChildAllocationRequest[];
  status: ProposalStatus;
  decision?: ProposalDecision;
  created_at: string;
  updated_at: string;
};

export type ProposalListParams = {
  status?: ProposalStatus | ProposalStatus[];
  project_id?: string;
  requester_id?: string;
  q?: string;
  limit?: number;
  offset?: number;
};
