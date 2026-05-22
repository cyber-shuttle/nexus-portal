import { apiFetch } from "@shared/api/client";
import type { CreditTransferResult } from "./types";
import {
  type CreditTransferPayload,
  creditTransferPayloadSchema,
  creditTransferResultSchema,
} from "./schemas";

export async function transferCredits(payload: CreditTransferPayload): Promise<CreditTransferResult> {
  const parsed = creditTransferPayloadSchema.parse(payload);
  const raw = await apiFetch("/tools/credit-transfer", {
    method: "POST",
    body: parsed,
  });
  return creditTransferResultSchema.parse(raw);
}
