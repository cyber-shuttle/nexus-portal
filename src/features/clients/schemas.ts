import { z } from "zod";
import { CLIENT_STATUSES } from "./types";

export const clientStatusSchema = z.enum(CLIENT_STATUSES);

export const clientSchema = z.object({
  id: z.string(),
  name: z.string(),
  allocation_id: z.string(),
  allocation_name: z.string().optional(),
  owner_user_id: z.string(),
  client_id: z.string(),
  client_secret_last4: z.string(),
  issued_at: z.string(),
  last_rotated_at: z.string().optional(),
  status: clientStatusSchema,
});

export const clientListResponseSchema = z.object({
  clients: z.array(clientSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
});

export const createClientPayloadSchema = z.object({
  name: z.string().min(2).max(120),
  allocation_id: z.string().min(1),
  owner_user_id: z.string().min(1),
});

export type CreateClientPayload = z.infer<typeof createClientPayloadSchema>;

export const rotateClientSecretPayloadSchema = z.object({
  rotated_by: z.string().min(1),
});

export type RotateClientSecretPayload = z.infer<typeof rotateClientSecretPayloadSchema>;

export const deactivateClientPayloadSchema = z.object({
  deactivated_by: z.string().min(1),
  reason: z.string().min(3).max(500),
});

export type DeactivateClientPayload = z.infer<typeof deactivateClientPayloadSchema>;
