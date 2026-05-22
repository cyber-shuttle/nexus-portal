import { apiFetch } from "@shared/api/client";
import { z } from "zod";
import {
  type AuthIdentity,
  type UpdatePreferencesPayload,
  type UserPreferences,
  authIdentitySchema,
  updatePreferencesPayloadSchema,
  userPreferencesSchema,
} from "./schemas";

export async function getMyPreferences(): Promise<UserPreferences> {
  const raw = await apiFetch("/me/preferences");
  return userPreferencesSchema.parse(raw);
}

export async function updateMyPreferences(
  payload: UpdatePreferencesPayload,
): Promise<UserPreferences> {
  const validated = updatePreferencesPayloadSchema.parse(payload);
  const raw = await apiFetch("/me/preferences", {
    method: "PUT",
    body: validated,
  });
  return userPreferencesSchema.parse(raw);
}

export async function getMyIdentities(): Promise<AuthIdentity[]> {
  const raw = await apiFetch("/me/identities");
  return z.array(authIdentitySchema).parse(raw ?? []);
}
