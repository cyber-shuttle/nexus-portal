import { cn } from "@/lib/utils";

export type SourcePillProps = {
  source: string;
  size?: "sm" | "md";
  className?: string;
};

const SOURCE_STYLES: Record<string, string> = {
  amie: "bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]",
  comanage: "bg-[color:var(--nexus-purple-50)] text-[color:var(--nexus-purple-700)]",
  slurm: "bg-[color:var(--nexus-amber-50)] text-[color:var(--nexus-amber-700)]",
  http: "bg-muted text-muted-foreground",
  core: "bg-muted text-muted-foreground",
};

// Unknown sources fall through to the neutral muted treatment — never crashes
// when the backend ships a new connector before the portal updates.
export function SourcePill({ source, size = "md", className }: SourcePillProps) {
  const key = source.toLowerCase();
  const styles = SOURCE_STYLES[key] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold tracking-tight whitespace-nowrap leading-none",
        size === "sm" ? "h-5 px-1.5 text-[11px]" : "h-5 px-2 text-[11.5px]",
        styles,
        className,
      )}
    >
      {key}
    </span>
  );
}
