import * as React from "react";
import { cn } from "@/lib/utils";

export type UsageBarProps = {
  value: number;
  max: number;
  label?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
};

function thresholdColor(ratio: number): string {
  if (ratio >= 0.9) return "bg-[color:var(--nexus-red-500)]";
  if (ratio >= 0.75) return "bg-[color:var(--nexus-amber-500)]";
  return "bg-[color:var(--nexus-blue-500)]";
}

export function UsageBar({
  value,
  max,
  label,
  ariaLabel,
  className,
  size = "md",
}: UsageBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const pct = Math.round(ratio * 1000) / 10;
  const heightClass = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>{pct.toFixed(1)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : "Usage")}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        tabIndex={0}
        className={cn("w-full overflow-hidden rounded-full bg-muted", heightClass)}
      >
        <div
          className={cn("h-full rounded-full transition-all", thresholdColor(ratio))}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export type SharedUsageBarProps = {
  mine: number;
  rest: number;
  max: number;
  label?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
};

export function SharedUsageBar({
  mine,
  rest,
  max,
  label,
  ariaLabel,
  className,
}: SharedUsageBarProps) {
  const safeMax = max <= 0 ? 1 : max;
  const mineRatio = Math.min(1, Math.max(0, mine / safeMax));
  const restRatio = Math.min(1 - mineRatio, Math.max(0, rest / safeMax));
  const minePct = Math.round(mineRatio * 1000) / 10;
  const restPct = Math.round(restRatio * 1000) / 10;
  return (
    <div className={cn("w-full", className)}>
      {label ? (
        <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span>
            {minePct.toFixed(1)}% you · {(minePct + restPct).toFixed(1)}% pool
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={ariaLabel ?? (typeof label === "string" ? label : "Shared usage")}
        aria-valuenow={mine + rest}
        aria-valuemin={0}
        aria-valuemax={max}
        tabIndex={0}
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-[color:var(--nexus-blue-500)]"
          style={{ width: `${minePct}%` }}
        />
        <div
          className="h-full bg-[color:var(--nexus-blue-300)] bg-[image:repeating-linear-gradient(45deg,transparent_0_4px,rgba(255,255,255,0.45)_4px_8px)]"
          style={{ width: `${restPct}%` }}
        />
      </div>
    </div>
  );
}
