"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transferCredits } from "./api";
import type { CreditTransferPayload } from "./schemas";

export function useTransferCredits() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreditTransferPayload) => transferCredits(payload),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["allocations"] });
      client.invalidateQueries({ queryKey: ["usage"] });
      client.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}
