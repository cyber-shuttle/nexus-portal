import { z } from "zod";

export type Tool = "rect" | "arrow" | "text" | "pen" | "redact";

export type Shape =
  | { id: string; type: "rect"; x: number; y: number; w: number; h: number }
  | { id: string; type: "arrow"; x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: "text"; x: number; y: number; text: string }
  | { id: string; type: "pen"; d: string }
  | { id: string; type: "redact"; x: number; y: number; w: number; h: number };

export const ShapeSchema: z.ZodType<Shape> = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("arrow"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("text"),
    x: z.number(),
    y: z.number(),
    text: z.string().max(500),
  }),
  z.object({
    id: z.string(),
    type: z.literal("pen"),
    d: z.string().max(20_000),
  }),
  z.object({
    id: z.string(),
    type: z.literal("redact"),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }),
]);

export const ComponentOutlineSchema = z.object({
  pageTitle: z.string().max(300).default(""),
  headings: z
    .array(z.object({ level: z.number().int().min(1).max(6), text: z.string().max(300) }))
    .max(100),
  navActive: z.string().max(120).default(""),
  navSiblings: z.array(z.string().max(120)).max(40),
  primaryButtons: z.array(z.string().max(120)).max(80),
  slots: z.array(z.string().max(80)).max(120),
});
export type ComponentOutline = z.infer<typeof ComponentOutlineSchema>;

export const FeedbackContextSchema = z.object({
  route: z.string(),
  persona: z.string(),
  reporterEmail: z.string().email(),
  viewport: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  userAgent: z.string().max(1000),
  buildSha: z.string().max(80),
  timestamp: z.string(),
  consoleErrors: z.array(z.string().max(2000)).max(10),
  componentOutline: ComponentOutlineSchema,
});
export type FeedbackContext = z.infer<typeof FeedbackContextSchema>;

export const FeedbackPayloadSchema = z.object({
  comment: z.string().min(10).max(5000),
  // ~2MB cap on the base64 image (~1.5MB raw). Larger PNGs get rejected
  // up-front so the GH Contents API never sees an oversized commit.
  // ~10 MB base64 ≈ 7.5 MB binary. Headroom for Retina full-viewport captures
  // while staying well under GitHub Contents API's 100 MB-per-file limit.
  imagePngBase64: z.string().min(100).max(10_000_000).optional(),
  annotations: z
    .object({
      schemaVersion: z.literal(1),
      imageWidth: z.number().int().positive(),
      imageHeight: z.number().int().positive(),
      shapes: z.array(ShapeSchema).max(200),
    })
    .optional(),
  context: FeedbackContextSchema,
});
export type FeedbackPayload = z.infer<typeof FeedbackPayloadSchema>;

export type ServerResponse =
  | { ok: true; issueUrl: string; issueNumber: number }
  | { ok: false; error: string };
