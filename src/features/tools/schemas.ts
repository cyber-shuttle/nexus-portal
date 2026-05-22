import { z } from "zod";

export const creditTransferPayloadSchema = z.object({
  source_allocation_id: z.string().min(1),
  destination_allocation_id: z.string().min(1),
  compute_allocation_resource_id: z.string().min(1),
  su_amount: z.number().int().positive(),
  transferred_by: z.string().min(1),
  note: z.string().max(500).optional(),
});

export type CreditTransferPayload = z.infer<typeof creditTransferPayloadSchema>;

export const creditTransferResultSchema = z.object({
  transfer_id: z.string(),
  source_allocation_id: z.string(),
  destination_allocation_id: z.string(),
  compute_allocation_resource_id: z.string(),
  su_amount: z.number().int(),
  transferred_by: z.string(),
  transferred_at: z.string(),
  source_balance_after: z.number().int(),
  destination_balance_after: z.number().int(),
});
