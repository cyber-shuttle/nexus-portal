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

export type TopNBarDatum = {
  // Bar label on the Y axis — typically a user id/email.
  label: string;
  // Numeric value driving the bar length.
  value: number;
  // Opaque payload for the click handler so containers can route to the right
  // drill drawer without re-deriving from the label.
  key: string;
};

export type TopNBarChartProps = {
  data: TopNBarDatum[];
  height?: number;
  ariaLabel?: string;
  onBarClick?: (datum: TopNBarDatum) => void;
};

// Horizontal bar chart for member-contribution + top-projects views.
// We use a vertical YAxis with category for the label and an XAxis for the
// magnitude — Recharts calls this `layout="vertical"`.
export function TopNBarChart({
  data,
  height = 240,
  ariaLabel = "Top contributors",
  onBarClick,
}: TopNBarChartProps) {
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--nexus-gray-100)" />
          <XAxis type="number" tick={{ fontSize: 12 }} stroke="var(--nexus-gray-400)" />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12 }}
            stroke="var(--nexus-gray-400)"
            width={120}
          />
          <Tooltip />
          <Bar
            dataKey="value"
            fill="var(--nexus-blue-500)"
            radius={[0, 4, 4, 0]}
            onClick={
              onBarClick
                ? (_, index) => {
                    const datum = data[index];
                    if (datum) onBarClick(datum);
                  }
                : undefined
            }
            cursor={onBarClick ? "pointer" : undefined}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
