import { apiFetch } from "@shared/api/client";
import {
  type CreateClientPayload,
  type DeactivateClientPayload,
  type RotateClientSecretPayload,
  clientListResponseSchema,
  clientSchema,
  createClientPayloadSchema,
  deactivateClientPayloadSchema,
  rotateClientSecretPayloadSchema,
} from "./schemas";
import type { Client, ClientListParams, ClientListResponse } from "./types";

function toQuery(params: ClientListParams): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.allocationId) search.set("allocationId", params.allocationId);
  if (params.ownerUserId) search.set("ownerUserId", params.ownerUserId);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  return search.toString();
}

export async function listClients(params: ClientListParams = {}): Promise<ClientListResponse> {
  const q = toQuery(params);
  const raw = await apiFetch(`/clients${q ? `?${q}` : ""}`);
  return clientListResponseSchema.parse(raw);
}

export async function getClient(id: string): Promise<Client> {
  const raw = await apiFetch(`/clients/${id}`);
  return clientSchema.parse(raw);
}

export async function createClient(payload: CreateClientPayload): Promise<Client> {
  const parsed = createClientPayloadSchema.parse(payload);
  const raw = await apiFetch("/clients", { method: "POST", body: parsed });
  return clientSchema.parse(raw);
}

export async function rotateClientSecret(
  id: string,
  payload: RotateClientSecretPayload,
): Promise<Client> {
  const parsed = rotateClientSecretPayloadSchema.parse(payload);
  const raw = await apiFetch(`/clients/${id}/rotate-secret`, {
    method: "POST",
    body: parsed,
  });
  return clientSchema.parse(raw);
}

export async function deactivateClient(
  id: string,
  payload: DeactivateClientPayload,
): Promise<Client> {
  const parsed = deactivateClientPayloadSchema.parse(payload);
  const raw = await apiFetch(`/clients/${id}/deactivate`, {
    method: "POST",
    body: parsed,
  });
  return clientSchema.parse(raw);
}
