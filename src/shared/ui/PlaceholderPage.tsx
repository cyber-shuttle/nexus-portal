import type { ReactNode } from "react";

type Props = {
  title: string;
  phase: number;
  description?: ReactNode;
};

export function PlaceholderPage({ title, phase, description }: Props) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 py-24 text-center">
      <span className="rounded-full bg-brand-tint px-4 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
        Phase {phase}
      </span>
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      <p className="text-base text-muted-foreground">
        {description ?? `This area is part of phase ${phase} and will land in a later build.`}
      </p>
    </div>
  );
}
