import { z } from "zod";

// Wire schemas for the saved-views endpoints. The Zod surface is the
// source of truth for the wire shape; the type aliases in `./types.ts`
// stay narrower for hand-rolled call sites.

export const personaSchema = z.enum(["researcher", "pi", "admin"]);

export const savedViewRangeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  preset: z.enum(["24h", "7d", "30d", "90d", "custom"]),
});

export const savedViewSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().min(1),
  // Names are user-supplied; 80 chars matches the cap we enforce in the
  // popover form so the wire schema stays the single source of truth.
  name: z.string().min(1).max(80),
  persona: personaSchema,
  range: savedViewRangeSchema,
  group_by: z.array(z.string()),
  filters: z.record(z.string(), z.unknown()),
  is_default: z.boolean(),
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
});

export const savedViewListSchema = z.array(savedViewSchema);

export const createSavedViewPayloadSchema = z.object({
  name: z.string().min(1).max(80),
  persona: personaSchema,
  range: savedViewRangeSchema,
  group_by: z.array(z.string()),
  filters: z.record(z.string(), z.unknown()).optional(),
  is_default: z.boolean().optional(),
});

export const updateSavedViewPayloadSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    is_default: z.boolean().optional(),
  })
  // At least one mutable field must be provided — empty bodies would
  // silently no-op which is worse than a 400 to the caller.
  .refine((v) => v.name !== undefined || v.is_default !== undefined, {
    message: "name or is_default required",
  });
