"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { Skeleton } from "@/shared/ui/skeleton";
import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTraceStats } from "../queries";
import { getTraceStatusInfo } from "../types";

// Status integers per spec §11.7. Order matters for the stack: ok at the
// base, error/cancelled/orphaned on top so failures pop out of the band.
const STATUS_ORDER: ReadonlyArray<0 | 1 | 2 | 3> = [0, 1, 2, 3];

// Use the 700-step CSS vars so the tooltip series labels clear WCAG AA on the
// white card; the area fillOpacity below softens the visual weight.
const STATUS_COLORS: Record<0 | 1 | 2 | 3, string> = {
  0: "var(--nexus-green-700)",
  1: "var(--nexus-red-700)",
  2: "var(--nexus-gray-500)",
  3: "var(--nexus-amber-700)",
};

type FlatBucket = { date: string; status: number; count: number };
type PivotedRow = { date: string; "0": number; "1": number; "2": number; "3": number };

function makePivotedRow(date: string): PivotedRow {
  return { date, "0": 0, "1": 0, "2": 0, "3": 0 };
}

// Wire format is one row per (date, status); Recharts wants a single row per
// date with one key per series. Fill absent buckets with 0 so the area stays
// continuous even when a status has no activity on a given day.
export function pivotByDay(buckets: ReadonlyArray<FlatBucket>): PivotedRow[] {
  const byDate = new Map<string, PivotedRow>();
  for (const b of buckets) {
    const row = byDate.get(b.date) ?? makePivotedRow(b.date);
    const key = String(b.status) as "0" | "1" | "2" | "3";
    if (key in row) row[key] = (row[key] ?? 0) + b.count;
    byDate.set(b.date, row);
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function TraceTrendChart() {
  const query = useTraceStats("30d");
  const buckets = query.data?.byDay ?? [];
  const data = React.useMemo(() => pivotByDay(buckets), [buckets]);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <header className="mb-3 flex items-baseline justify-between">
        <h2 className="font-heading text-sm font-semibold">Trend (last 30d)</h2>
        <p className="text-xs text-muted-foreground">traces/day · by status</p>
      </header>

      {query.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : query.error ? (
        <ErrorState message="Failed to load trace stats." onRetry={() => query.refetch()} />
      ) : data.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No data in the last 30 days.
        </p>
      ) : (
        <>
          <div role="img" aria-label="Trace counts per day grouped by status">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--nexus-gray-100)" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--nexus-gray-400)" />
                <YAxis tick={{ fontSize: 12 }} stroke="var(--nexus-gray-400)" />
                <Tooltip />
                {STATUS_ORDER.map((s) => (
                  <Area
                    key={s}
                    type="monotone"
                    name={getTraceStatusInfo(s).label}
                    dataKey={String(s)}
                    stackId="1"
                    stroke={STATUS_COLORS[s]}
                    fill={STATUS_COLORS[s]}
                    fillOpacity={0.4}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="inline-block size-2 rounded-full"
                  style={{ background: STATUS_COLORS[s] }}
                />
                {getTraceStatusInfo(s).label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
