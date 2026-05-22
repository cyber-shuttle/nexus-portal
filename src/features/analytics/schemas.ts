import { z } from "zod";

// Zod placeholders only — fleshed out in A1–A3 when API shapes settle.

export const analyticsRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  preset: z.enum(["24h", "7d", "30d", "90d", "custom"]),
});

export const kpiValueSchema = z.object({
  title: z.string(),
  value: z.union([z.number(), z.string()]),
  delta: z
    .object({
      value: z.number(),
      unit: z.string().optional(),
      direction: z.enum(["up", "down"]),
    })
    .optional(),
  deltaTone: z.enum(["positive", "negative", "neutral"]).optional(),
  sparkline: z.array(z.number()).optional(),
});

export const analyticsDashboardSchema = z.object({
  persona: z.enum(["admin", "pi", "researcher"]),
  range: analyticsRangeSchema,
  syncedAt: z.string(),
  kpis: z.array(kpiValueSchema),
});
