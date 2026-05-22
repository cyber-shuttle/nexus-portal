import { cn } from "@/lib/utils";

export type PersonaPillProps = {
  label: string;
  tone?: "researcher" | "pi" | "admin";
  className?: string;
};

const toneStyles: Record<NonNullable<PersonaPillProps["tone"]>, string> = {
  researcher:
    "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)] ring-[color:var(--nexus-blue-200)]",
  pi: "bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)] ring-[color:var(--nexus-green-200)]",
  admin:
    "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)] ring-[color:var(--nexus-amber-200)]",
};

export function PersonaPill({ label, tone = "researcher", className }: PersonaPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneStyles[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
