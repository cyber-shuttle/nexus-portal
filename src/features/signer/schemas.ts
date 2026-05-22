import { z } from "zod";
import { CERTIFICATE_STATUSES } from "./types";

export const certificateStatusSchema = z.enum(CERTIFICATE_STATUSES);

export const certificateSchema = z.object({
  serial_number: z.number().int().nonnegative(),
  client_id: z.string().optional(),
  allocation_id: z.string().optional(),
  allocation_name: z.string().optional(),
  key_id: z.string(),
  principal: z.string(),
  username: z.string(),
  public_key_fingerprint: z.string(),
  ca_fingerprint: z.string(),
  valid_after: z.number().int(),
  valid_before: z.number().int(),
  issued_at: z.number().int(),
  source_ip: z.string().optional(),
  granted_extensions: z.array(z.string()).default([]),
  force_command: z.string().nullable().optional(),
  revoked: z.boolean(),
  revoked_at: z.number().int().optional(),
  revocation_reason: z.string().optional(),
});

export const certificateListResponseSchema = z.object({
  certificates: z.array(certificateSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
});

export const revokeCertificatePayloadSchema = z.object({
  reason: z.string().min(3, "Provide a revocation reason").max(500),
});

export type RevokeCertificatePayload = z.infer<typeof revokeCertificatePayloadSchema>;
