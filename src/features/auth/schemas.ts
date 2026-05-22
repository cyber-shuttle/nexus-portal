import { z } from "zod";

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
