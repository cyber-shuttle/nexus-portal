export function formatSU(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatRate(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  return n.toFixed(4);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

// Light "x minutes ago" formatter — keeps the StatCard sub-line one short
// phrase. Intentionally coarse (minute / hour / day buckets) — anything finer
// would churn the rendered text every render.
export function formatRelative(input: Date | number | string, now: Date = new Date()): string {
  const then = input instanceof Date ? input : new Date(input);
  const diffMs = now.getTime() - then.getTime();
  if (!Number.isFinite(diffMs)) return "just now";
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return formatDate(then.toISOString());
}
