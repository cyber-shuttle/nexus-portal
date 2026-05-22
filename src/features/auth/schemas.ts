import { z } from "zod";

// Mirror of features/members userIdentitySchema. Auth feature stays isolated
// from members per §5; in practice these shapes are negotiated through the
// same backend contract (docs/backend-contracts/auth.md).
export const authIdentitySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  source: z.string(),
  external_id: z.string(),
  email: z.string().optional(),
  oidc_sub: z.string().optional(),
  metadata: z.string().optional(),
  created_at: z.string(),
});
export type AuthIdentity = z.infer<typeof authIdentitySchema>;

export const userPreferencesSchema = z.object({
  user_id: z.string(),
  timezone: z.string().min(1).max(64),
  notify_on_change_request_decided: z.boolean(),
  notify_on_proposal_decided: z.boolean(),
});
export type UserPreferences = z.infer<typeof userPreferencesSchema>;

export const updatePreferencesPayloadSchema = z.object({
  timezone: z.string().min(1).max(64),
  notify_on_change_request_decided: z.boolean(),
  notify_on_proposal_decided: z.boolean(),
});
export type UpdatePreferencesPayload = z.infer<typeof updatePreferencesPayloadSchema>;
