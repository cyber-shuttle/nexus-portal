import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type AnalyticsCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  rightSlot?: ReactNode;
  className?: string;
  children: ReactNode;
};

// Inline layout helper — spec §8 chart-card chrome. Kept local to the
// analytics feature per the A1 brief: not a new shared primitive.
export function AnalyticsCard({
  title,
  subtitle,
  rightSlot,
  className,
  children,
}: AnalyticsCardProps) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-card p-5 shadow-sm", className)}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {rightSlot ? <div className="shrink-0 text-sm">{rightSlot}</div> : null}
      </header>
      {children}
    </section>
  );
}
