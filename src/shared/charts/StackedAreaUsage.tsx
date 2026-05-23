"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const DEFAULT_COLORS = [
  "var(--nexus-blue-500)",
  "var(--nexus-green-500)",
  "var(--nexus-amber-500)",
  "var(--nexus-red-500)",
  "var(--nexus-blue-300)",
];

export type StackedAreaUsageProps = {
  data: Array<{ date: string } & Record<string, string | number>>;
  seriesKeys: string[];
  colors?: string[];
  height?: number;
  ariaLabel?: string;
  // Recharts fires Area `onClick` with the active datum; we extract the date
  // and pass it back alongside the series key so callers can build deep-links
  // without depending on Recharts payload internals (spec §6.3 click contract).
  onSegmentClick?: (seriesKey: string, date: string) => void;
};

export function StackedAreaUsage({
  data,
  seriesKeys,
  colors = DEFAULT_COLORS,
  height = 240,
  ariaLabel,
  onSegmentClick,
}: StackedAreaUsageProps) {
  return (
    <div role="img" aria-label={ariaLabel ?? "Stacked area usage chart"}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--nexus-gray-100)" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="var(--nexus-gray-400)" />
          <YAxis tick={{ fontSize: 12 }} stroke="var(--nexus-gray-400)" />
          <Tooltip />
          {seriesKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={colors[i % colors.length]}
              fill={colors[i % colors.length]}
              fillOpacity={0.4}
              onClick={
                onSegmentClick
                  ? (props) => {
                      const payload = (props as { payload?: { date?: string } } | undefined)
                        ?.payload;
                      const date = payload?.date;
                      if (typeof date === "string") onSegmentClick(key, date);
                    }
                  : undefined
              }
              style={onSegmentClick ? { cursor: "pointer" } : undefined}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
