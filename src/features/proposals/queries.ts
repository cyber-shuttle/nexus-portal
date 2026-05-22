"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveProposal,
  createProposal,
  denyProposal,
  getProposal,
  listProposals,
  updateProposal,
  withdrawProposal,
} from "./api";
import type {
  CreateProposalPayload,
  ProposalDecisionPayload,
  UpdateProposalPayload,
} from "./schemas";
import type { ProposalListParams } from "./types";

export const proposalKeys = {
  all: ["proposals"] as const,
  list: (params: ProposalListParams) => [...proposalKeys.all, "list", params] as const,
  detail: (id: string) => [...proposalKeys.all, "detail", id] as const,
};

export function useProposals(params: ProposalListParams = {}) {
  return useQuery({
    queryKey: proposalKeys.list(params),
    queryFn: () => listProposals(params),
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: id ? proposalKeys.detail(id) : ["proposals", "detail", "none"],
    queryFn: () => getProposal(id as string),
    enabled: Boolean(id),
  });
}

function invalidate(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: proposalKeys.all });
}

export function useCreateProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProposalPayload) => createProposal(payload),
    onSuccess: () => invalidate(client),
  });
}

export function useUpdateProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateProposalPayload }) =>
      updateProposal(id, patch),
    onSuccess: () => invalidate(client),
  });
}

export function useApproveProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ProposalDecisionPayload }) =>
      approveProposal(id, decision),
    onSuccess: () => invalidate(client),
  });
}

export function useDenyProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: ProposalDecisionPayload }) =>
      denyProposal(id, decision),
    onSuccess: () => invalidate(client),
  });
}

export function useWithdrawProposal() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, requesterId }: { id: string; requesterId: string }) =>
      withdrawProposal(id, requesterId),
    onSuccess: () => invalidate(client),
  });
}
