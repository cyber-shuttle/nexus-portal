"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type WaitTimeBarDatum = {
  queue: string;
  avg_wait_seconds: number;
  p50: number;
  p90: number;
  sample_size: number;
};

function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem === 0 ? `${minutes}m` : `${minutes}m ${rem}s`;
}

export function WaitTimeBars({ data }: { data: WaitTimeBarDatum[] }) {
  return (
    <div role="img" aria-label="Average wait time by queue">
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--nexus-gray-100)" />
          <XAxis dataKey="queue" tick={{ fontSize: 12 }} stroke="var(--nexus-gray-400)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--nexus-gray-400)" tickFormatter={formatSeconds} />
          <Tooltip
            formatter={(value) => formatSeconds(typeof value === "number" ? value : Number(value))}
          />
          <Bar dataKey="avg_wait_seconds" fill="var(--nexus-blue-500)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
