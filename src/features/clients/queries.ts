"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, deactivateClient, getClient, listClients, rotateClientSecret } from "./api";
import type {
  CreateClientPayload,
  DeactivateClientPayload,
  RotateClientSecretPayload,
} from "./schemas";
import type { ClientListParams } from "./types";

export const clientKeys = {
  all: ["clients"] as const,
  list: (params: ClientListParams) => [...clientKeys.all, "list", params] as const,
  detail: (id: string) => [...clientKeys.all, "detail", id] as const,
};

export function useClients(params: ClientListParams = {}) {
  return useQuery({
    queryKey: clientKeys.list(params),
    queryFn: () => listClients(params),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: id ? clientKeys.detail(id) : clientKeys.detail("none"),
    queryFn: () => getClient(id as string),
    enabled: Boolean(id),
  });
}

function invalidate(client: ReturnType<typeof useQueryClient>) {
  client.invalidateQueries({ queryKey: clientKeys.all });
}

export function useCreateClient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateClientPayload) => createClient(payload),
    onSuccess: () => invalidate(client),
  });
}

export function useRotateClientSecret() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RotateClientSecretPayload }) =>
      rotateClientSecret(id, payload),
    onSuccess: () => invalidate(client),
  });
}

export function useDeactivateClient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: DeactivateClientPayload }) =>
      deactivateClient(id, payload),
    onSuccess: () => invalidate(client),
  });
}
