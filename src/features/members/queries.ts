"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import {
  getMembershipOverrides,
  getMembershipsForAllocation,
  getMembershipsForUser,
  getUserById,
  getUserIdentities,
} from "./api";
import type {
  ComputeAllocationMembership,
  ComputeAllocationMembershipResourceOverride,
  User,
} from "./schemas";

export const memberKeys = {
  all: ["members"] as const,
  forAllocation: (allocId: string) => [...memberKeys.all, "allocation", allocId] as const,
  forUser: (userId: string) => [...memberKeys.all, "for-user", userId] as const,
  overrides: (membershipId: string) =>
    [...memberKeys.all, "membership", membershipId, "overrides"] as const,
  user: (userId: string) => [...memberKeys.all, "user", userId] as const,
  identities: (userId: string) => [...memberKeys.user(userId), "identities"] as const,
};

export function useMembershipsForAllocation(allocId: string | undefined) {
  return useQuery({
    queryKey: allocId ? memberKeys.forAllocation(allocId) : ["members", "allocation", "none"],
    queryFn: () => getMembershipsForAllocation(allocId as string),
    enabled: Boolean(allocId),
  });
}

export function useMembershipsForUser(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? memberKeys.forUser(userId) : ["members", "for-user", "none"],
    queryFn: () => getMembershipsForUser(userId as string),
    enabled: Boolean(userId),
  });
}

export function useMembershipOverrides(membershipId: string | undefined) {
  return useQuery({
    queryKey: membershipId
      ? memberKeys.overrides(membershipId)
      : ["members", "overrides", "none"],
    queryFn: () => getMembershipOverrides(membershipId as string),
    enabled: Boolean(membershipId),
  });
}

export function useUser(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? memberKeys.user(userId) : ["members", "user", "none"],
    queryFn: () => getUserById(userId as string),
    enabled: Boolean(userId),
  });
}

export function useUserIdentities(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? memberKeys.identities(userId) : ["members", "identities", "none"],
    queryFn: () => getUserIdentities(userId as string),
    enabled: Boolean(userId),
  });
}

export type AllocationMemberRow = {
  membership: ComputeAllocationMembership;
  user: User | null;
};

export function useAllocationMembers(allocId: string | undefined) {
  const membershipsQuery = useMembershipsForAllocation(allocId);
  const memberships = membershipsQuery.data ?? [];

  const userQueries = useQueries({
    queries: memberships.map((m) => ({
      queryKey: memberKeys.user(m.user_id),
      queryFn: () => getUserById(m.user_id),
      enabled: Boolean(m.user_id),
    })),
  });

  const usersLoading = userQueries.some((q) => q.isLoading);
  const usersError = userQueries.find((q) => q.error)?.error ?? null;

  const rows: AllocationMemberRow[] = memberships.map((m, i) => ({
    membership: m,
    user: (userQueries[i]?.data as User | undefined) ?? null,
  }));

  return {
    data: rows,
    isLoading: membershipsQuery.isLoading || usersLoading,
    error: (membershipsQuery.error ?? usersError) as Error | null,
    refetch: membershipsQuery.refetch,
  };
}

export type MemberOverrideRow = ComputeAllocationMembershipResourceOverride;
