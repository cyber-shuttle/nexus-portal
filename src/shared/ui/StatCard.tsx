import { cn } from "@/lib/utils";
import * as React from "react";

export type StatCardProps = {
  title: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; label?: string };
  className?: string;
};

export function StatCard({ title, value, sublabel, trend, className }: StatCardProps) {
  return (
    <div className={cn("rounded-md border bg-card p-5 shadow-sm", className)}>
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="mt-2 font-heading text-3xl font-semibold text-foreground">{value}</div>
      {sublabel ? <div className="mt-1 text-sm text-muted-foreground">{sublabel}</div> : null}
      {trend ? (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            trend.direction === "up" &&
              "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)]",
            trend.direction === "down" &&
              "bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)]",
            trend.direction === "flat" && "bg-muted text-muted-foreground",
          )}
        >
          <span aria-hidden="true">
            {trend.direction === "up" ? "▲" : trend.direction === "down" ? "▼" : "■"}
          </span>
          <span>{trend.label}</span>
        </div>
      ) : null}
    </div>
  );
}
