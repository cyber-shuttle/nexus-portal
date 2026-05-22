"use client";

import { useQuery } from "@tanstack/react-query";
import { getAllocationDiffs } from "./api";

export const auditKeys = {
  all: ["audit"] as const,
  diffs: (allocId: string) => [...auditKeys.all, "diffs", allocId] as const,
};

export function useAllocationDiffs(allocId: string | undefined) {
  return useQuery({
    queryKey: allocId ? auditKeys.diffs(allocId) : ["audit", "diffs", "none"],
    queryFn: () => getAllocationDiffs(allocId as string),
    enabled: Boolean(allocId),
  });
}
