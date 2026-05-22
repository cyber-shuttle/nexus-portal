// Shared ID + secret generators for the MSW seed. Both seed builders and
// runtime handlers route through these helpers so a row's id format and
// `client_id` slug never depend on which code path created it.

export function nextClientRowId(existingIds: string[]): string {
  let max = 0;
  for (const id of existingIds) {
    const match = id.match(/^client-(\d+)$/);
    if (!match || !match[1]) continue;
    max = Math.max(max, Number.parseInt(match[1], 10));
  }
  return `client-${String(max + 1).padStart(3, "0")}`;
}

export function clientSlug(allocationId: string, ordinal: number): string {
  return `nexus-${allocationId}-${ordinal}`;
}

export function randomSecretLast4(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
