import { cn } from "@/lib/utils";
import { UsageBar } from "@/shared/ui/UsageBar";
import type { ElementType, ReactNode } from "react";

// Card chrome shared by both variants. Bigger radius + softer shadow keeps the
// 3-up row from competing with the page title.
const cardChrome = "rounded-lg border border-border bg-card p-5 shadow-sm";

// Title row: tight uppercase muted label + optional inline lucide icon.
function StatCardTitle({ icon: Icon, title }: { icon?: ElementType; title: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {Icon ? <Icon className="h-4 w-4 stroke-[1.5]" /> : null}
      <span>{title}</span>
    </div>
  );
}

type CommonProps = {
  icon?: ElementType;
  title: ReactNode;
  value: ReactNode;
  className?: string;
};

type TextProps = CommonProps & {
  variant?: "text";
  sub?: ReactNode;
  /** @deprecated use `sub` */
  sublabel?: ReactNode;
  /** @deprecated trend pill is no longer in spec; will be removed in S5 */
  trend?: { direction: "up" | "down" | "flat"; label?: string };
};

type ProgressProps = CommonProps & {
  variant: "progress";
  percent: number;
};

export type StatCardProps = TextProps | ProgressProps;

export function StatCard(props: StatCardProps) {
  if (props.variant === "progress") {
    const { icon, title, value, percent, className } = props;
    const clamped = Math.max(0, Math.min(100, percent));
    return (
      <div className={cn(cardChrome, className)}>
        <StatCardTitle icon={icon} title={title} />
        <div className="mt-2 flex items-baseline justify-between gap-2">
          <span className="font-display text-3xl font-bold text-foreground tabular-nums">
            {value}
          </span>
          <span className="text-sm font-medium text-muted-foreground tabular-nums">
            {clamped.toFixed(0)}%
          </span>
        </div>
        <UsageBar value={clamped} max={100} size="md" className="mt-3" />
      </div>
    );
  }

  const { icon, title, value, sub, sublabel, trend, className } = props;
  const subLine = sub ?? sublabel;
  return (
    <div className={cn(cardChrome, className)}>
      <StatCardTitle icon={icon} title={title} />
      <div className="mt-2 font-display text-3xl font-bold text-foreground tabular-nums">
        {value}
      </div>
      {subLine ? <div className="mt-2 text-xs text-muted-foreground">{subLine}</div> : null}
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

export function StatCardRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-3", className)}>{children}</div>
  );
}
