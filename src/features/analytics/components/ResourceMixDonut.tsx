"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export type ResourceMixDonutDatum = {
  resource_id: string;
  total: number;
};

const COLORS = [
  "var(--nexus-blue-500)",
  "var(--nexus-green-500)",
  "var(--nexus-amber-500)",
  "var(--nexus-red-500)",
  "var(--nexus-blue-300)",
];

export function ResourceMixDonut({ data }: { data: ResourceMixDonutDatum[] }) {
  return (
    <div role="img" aria-label="Resource mix donut">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="resource_id"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            {data.map((slice, i) => (
              <Cell
                key={slice.resource_id}
                fill={COLORS[i % COLORS.length]}
                stroke="var(--nexus-gray-100)"
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
