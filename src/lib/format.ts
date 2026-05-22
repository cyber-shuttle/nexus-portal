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
