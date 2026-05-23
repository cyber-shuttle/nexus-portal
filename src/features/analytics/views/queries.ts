"use client";

import type { AnalyticsPersona } from "@shared/auth/personaForAnalytics";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSavedView,
  deleteSavedView,
  getSavedViews,
  updateSavedView,
} from "./api";
import type {
  CreateSavedViewPayload,
  SavedView,
  UpdateSavedViewPayload,
} from "./types";

// Keyed by (persona, userId) so a persona switch never serves stale chips
// from the prior persona, and an account switch invalidates cleanly.
export const savedViewKeys = {
  all: ["analytics", "saved-views"] as const,
  list: (persona: AnalyticsPersona, userId: string | null) =>
    [...savedViewKeys.all, persona, userId ?? "anonymous"] as const,
};

export function useSavedViews(
  persona: AnalyticsPersona,
  userId: string | null,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: savedViewKeys.list(persona, userId),
    queryFn: () => getSavedViews(persona, userId),
    enabled: options.enabled ?? true,
  });
}

export function useCreateSavedView(persona: AnalyticsPersona, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<SavedView, Error, CreateSavedViewPayload>({
    mutationFn: (payload) => createSavedView(payload, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.list(persona, userId) });
    },
  });
}

export function useUpdateSavedView(persona: AnalyticsPersona, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<SavedView, Error, { id: string; payload: UpdateSavedViewPayload }>({
    mutationFn: ({ id, payload }) => updateSavedView(id, payload, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.list(persona, userId) });
    },
  });
}

export function useDeleteSavedView(persona: AnalyticsPersona, userId: string | null) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteSavedView(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: savedViewKeys.list(persona, userId) });
    },
  });
}
