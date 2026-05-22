"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/**
 * `?gb=a,b,c` <-> `string[]` page-state. Returns/accepts the full list because
 * one page composes multiple `GroupByChip`s; each chip's single-value
 * `onChange` is spliced into its slot before calling `setGroupBy`.
 */
export function useUrlGroupBy() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const groupBy = React.useMemo<string[]>(() => {
    const raw = searchParams.get("gb");
    if (!raw) return [];
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }, [searchParams]);

  const setGroupBy = React.useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const cleaned = next.map((v) => v.trim()).filter((v) => v.length > 0);
      if (cleaned.length === 0) {
        params.delete("gb");
      } else {
        params.set("gb", cleaned.join(","));
      }
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  return { groupBy, setGroupBy };
}
