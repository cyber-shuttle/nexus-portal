"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyIdentities, getMyPreferences, updateMyPreferences } from "./api";

export const meKeys = {
  all: ["me"] as const,
  preferences: () => [...meKeys.all, "preferences"] as const,
  identities: () => [...meKeys.all, "identities"] as const,
};

export function useMyPreferences() {
  return useQuery({
    queryKey: meKeys.preferences(),
    queryFn: getMyPreferences,
  });
}

export function useUpdateMyPreferences() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: updateMyPreferences,
    onSuccess: () => client.invalidateQueries({ queryKey: meKeys.preferences() }),
  });
}

export function useMyIdentities() {
  return useQuery({
    queryKey: meKeys.identities(),
    queryFn: getMyIdentities,
  });
}
