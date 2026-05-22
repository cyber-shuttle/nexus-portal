"use client";

import { StackedAreaUsage } from "@shared/charts/StackedAreaUsage";
import * as React from "react";
import type { PacketStatBucket, PacketStatus } from "../types";

const STATUS_ORDER: PacketStatus[] = ["PROCESSED", "DECODED", "NEW", "FAILED"];
// Recharts paints both the area fill AND the tooltip label in the same color
// on a white background. Use the 700-step so tooltip labels clear WCAG AA
// 4.5:1; the area fill is rendered with fillOpacity 0.4 so it still looks soft.
const STATUS_COLORS: Record<PacketStatus, string> = {
  PROCESSED: "var(--nexus-green-700)",
  DECODED: "var(--nexus-amber-700)",
  NEW: "var(--nexus-blue-700)",
  FAILED: "var(--nexus-red-700)",
};

export type PacketsTrendChartProps = {
  buckets: PacketStatBucket[];
  height?: number;
};

export function PacketsTrendChart({ buckets, height = 220 }: PacketsTrendChartProps) {
  const byDay = React.useMemo(() => {
    const days = new Map<string, Record<PacketStatus, number> & { date: string }>();
    for (const b of buckets) {
      const row =
        days.get(b.date) ??
        ({ date: b.date, NEW: 0, DECODED: 0, PROCESSED: 0, FAILED: 0 } as Record<
          PacketStatus,
          number
        > & { date: string });
      row[b.status] = (row[b.status] ?? 0) + b.count;
      days.set(b.date, row);
    }
    return Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [buckets]);

  if (byDay.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No packet activity in the selected window.</p>
    );
  }

  return (
    <div className="rounded-md border bg-card p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-sm font-semibold">Packets per day</h2>
        <p className="text-xs text-muted-foreground">last {byDay.length} days · by status</p>
      </header>
      <StackedAreaUsage
        data={byDay}
        seriesKeys={STATUS_ORDER}
        colors={STATUS_ORDER.map((s) => STATUS_COLORS[s])}
        height={height}
        ariaLabel="AMIE packets per day grouped by status"
      />
      <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        {STATUS_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1">
            <span
              aria-hidden="true"
              className="inline-block size-2 rounded-full"
              style={{ background: STATUS_COLORS[s] }}
            />
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
