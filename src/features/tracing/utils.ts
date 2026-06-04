import type { LinkedEntity, LinkedEntityField, Span, WaterfallNode } from "./types";

// Truncate a hex id (trace_id 32 chars, span_id 16 chars) to a leading prefix
// for compact display in tables/badges. Default prefix length is 8.
export function shortHex(value: string | undefined | null, length = 8): string {
  if (!value) return "";
  return value.length > length ? value.slice(0, length) : value;
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1) return "<1ms";
  if (ms < 1_000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1_000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 2 : 1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds - minutes * 60);
  return `${minutes}m ${remaining}s`;
}

export function durationBetween(startIso: string, endIso?: string | null): number | null {
  if (!endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

export function formatAbsoluteUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().replace("T", " ").replace("Z", "")} UTC`;
}

const MIN_MS = 60 * 1000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelative(iso: string, now: number = Date.now()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const ageMs = Math.max(0, now - t);
  if (ageMs < MIN_MS) return "just now";
  if (ageMs < HOUR_MS) return `${Math.floor(ageMs / MIN_MS)} min ago`;
  if (ageMs < DAY_MS) return `${Math.floor(ageMs / HOUR_MS)}h ago`;
  return `${Math.floor(ageMs / DAY_MS)}d ago`;
}

// Hoisted from the table / overview tab — clipboard write + sonner toast
// is the same shape in both call sites. Lazily import sonner so test setups
// don't have to mock it just to load utils.ts.
export async function copyTraceId(traceId: string): Promise<void> {
  const { toast } = await import("sonner");
  try {
    await navigator.clipboard.writeText(traceId);
    toast.success("Copied", { description: shortHex(traceId, 12) });
  } catch {
    toast.error("Could not copy to clipboard");
  }
}

// Spec §11.2: a span is a retry root when its name starts with `retry:` or it
// carries a `retry.attempt` attribute. Retry roots render as sibling subtrees
// of the original root, not children of their wire-level parent_span_id.
export function isRetryRoot(span: Span): boolean {
  if (span.name.startsWith("retry:")) return true;
  const attrs = span.attributes;
  if (attrs && typeof attrs === "object") {
    const raw = (attrs as Record<string, unknown>)["retry.attempt"];
    if (raw != null) return true;
  }
  return false;
}

// Build a forest of WaterfallNodes. Retry roots become top-level siblings of
// the original root. Spans whose parent_span_id points outside the input set
// are also treated as top-level (orphans). Sibling order = start_time asc.
export function buildSpanTree(spans: Span[], maxDepth = 50): WaterfallNode[] {
  const byId = new Map<string, Span>();
  for (const s of spans) byId.set(s.span_id, s);

  const childrenOf = new Map<string, Span[]>();
  const roots: Span[] = [];
  for (const s of spans) {
    if (isRetryRoot(s) || !s.parent_span_id || !byId.has(s.parent_span_id)) {
      roots.push(s);
      continue;
    }
    const list = childrenOf.get(s.parent_span_id) ?? [];
    list.push(s);
    childrenOf.set(s.parent_span_id, list);
  }

  const sortByStart = (a: Span, b: Span) => Date.parse(a.start_time) - Date.parse(b.start_time);

  function build(span: Span, depth: number): WaterfallNode {
    // Defensive: retry roots are already lifted to roots[] above, so they
    // can't appear here; keep the filter for the symmetry of the invariant.
    const rawKids = (childrenOf.get(span.span_id) ?? [])
      .filter((c) => !isRetryRoot(c))
      .sort(sortByStart);
    if (depth >= maxDepth) {
      // Past the depth cap, summarize the subtree count so the UI can render
      // a "+N collapsed" pill instead of more rows.
      const collapsed = countSubtree(rawKids, childrenOf);
      return { span, depth, children: [], collapsedCount: collapsed };
    }
    const children = rawKids.map((c) => build(c, depth + 1));
    return { span, depth, children, collapsedCount: 0 };
  }

  return roots.sort(sortByStart).map((r) => build(r, 0));
}

function countSubtree(spans: Span[], childrenOf: Map<string, Span[]>): number {
  let n = 0;
  for (const s of spans) {
    n += 1;
    const kids = childrenOf.get(s.span_id);
    if (kids && kids.length > 0) n += countSubtree(kids, childrenOf);
  }
  return n;
}

// Depth-first flatten preserving the visual tree order; consumers slice for
// windowing past 200 rows (spec §10 risk #2).
export function flattenTree(nodes: WaterfallNode[]): WaterfallNode[] {
  const out: WaterfallNode[] = [];
  const walk = (n: WaterfallNode) => {
    out.push(n);
    for (const c of n.children) walk(c);
  };
  for (const n of nodes) walk(n);
  return out;
}

export function spanDurationMs(span: Span): number {
  return durationBetween(span.start_time, span.end_time ?? null) ?? 0;
}

// P95 across sibling durations, ignoring zero-duration spans so "slow"
// detection isn't dominated by no-op bus spans. Linear-interpolated.
export function percentile(values: number[], p: number): number {
  const filtered = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (filtered.length === 0) return 0;
  if (filtered.length === 1) return filtered[0] ?? 0;
  const rank = (p / 100) * (filtered.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return filtered[lo] ?? 0;
  const fraction = rank - lo;
  const low = filtered[lo] ?? 0;
  const high = filtered[hi] ?? 0;
  return low + (high - low) * fraction;
}

// Per-parent-id sibling P95 lookup. Top-level roots share a synthetic bucket
// keyed by empty string so retry roots compete with the original root.
export function computeSiblingP95(nodes: WaterfallNode[]): Map<string, number> {
  const groups = new Map<string, number[]>();
  const walk = (node: WaterfallNode, parentKey: string) => {
    const arr = groups.get(parentKey) ?? [];
    arr.push(spanDurationMs(node.span));
    groups.set(parentKey, arr);
    for (const c of node.children) walk(c, node.span.span_id);
  };
  for (const n of nodes) walk(n, "");
  const out = new Map<string, number>();
  for (const [k, v] of groups) out.set(k, percentile(v, 95));
  return out;
}

// Map child span_id → parent key used by computeSiblingP95 so a row can look
// up its sibling-group P95 without re-walking the tree.
export function buildParentKeyMap(nodes: WaterfallNode[]): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (node: WaterfallNode, parentKey: string) => {
    out.set(node.span.span_id, parentKey);
    for (const c of node.children) walk(c, node.span.span_id);
  };
  for (const n of nodes) walk(n, "");
  return out;
}

// --- Linked entities (Phase 4B) ---

function readAttr(span: Span, key: string): string | undefined {
  const attrs = span.attributes;
  if (!attrs || typeof attrs !== "object") return undefined;
  const raw = (attrs as Record<string, unknown>)[key];
  if (raw == null) return undefined;
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return undefined;
}

// Aggregate span attributes into entity cards per spec §11.8. Walks every span
// (not just the root) and dedupes by primary id so the same packet_id surfacing
// in root + child shows up once.
export function extractLinkedEntities(spans: Span[]): LinkedEntity[] {
  const out: LinkedEntity[] = [];
  const seen = new Set<string>();

  const push = (entity: LinkedEntity) => {
    const dedupeKey = `${entity.kind}::${entity.primaryId ?? JSON.stringify(entity.fields)}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    out.push(entity);
  };

  for (const span of spans) {
    const packetId = readAttr(span, "amie.packet_id");
    const eventId = readAttr(span, "amie.event_id");
    const eventType = readAttr(span, "amie.event_type");
    if (packetId || eventId) {
      const fields: LinkedEntityField[] = [];
      if (packetId) fields.push({ key: "Packet ID", value: packetId });
      if (eventId) fields.push({ key: "Event ID", value: eventId });
      if (eventType) fields.push({ key: "Event type", value: eventType });
      push({
        kind: "amiePacket",
        title: "AMIE Packet",
        primaryId: packetId ?? eventId,
        fields,
        href: packetId ? `/admin/amie/packets/${encodeURIComponent(packetId)}` : undefined,
        ctaLabel: packetId ? "Open packet →" : undefined,
      });
    }

    const coId = readAttr(span, "comanage.co_id");
    const email = readAttr(span, "comanage.email");
    const clusterUserId = readAttr(span, "comanage.cluster_user_id");
    if (coId || email || clusterUserId) {
      const fields: LinkedEntityField[] = [];
      if (coId) fields.push({ key: "CO ID", value: coId });
      if (clusterUserId) fields.push({ key: "Cluster user ID", value: clusterUserId });
      // §11.8: comanage.email is PII; tuck behind a Show contact info toggle.
      if (email) fields.push({ key: "Email", value: email, pii: true });
      push({
        kind: "comanagePerson",
        title: "COmanage Person",
        primaryId: coId ?? clusterUserId ?? email,
        fields,
      });
    }

    const allocationId = readAttr(span, "slurm.allocation_id");
    if (allocationId) {
      push({
        kind: "allocation",
        title: "Allocation",
        primaryId: allocationId,
        fields: [{ key: "Allocation ID", value: allocationId }],
        href: `/allocations/${encodeURIComponent(allocationId)}`,
        ctaLabel: "Open allocation →",
      });
    }

    const clusterId = readAttr(span, "slurm.cluster_id");
    if (clusterId) {
      push({
        kind: "cluster",
        title: "Cluster",
        primaryId: clusterId,
        fields: [{ key: "Cluster ID", value: clusterId }],
      });
    }

    const slurmUserId = readAttr(span, "slurm.user_id");
    if (slurmUserId) {
      push({
        kind: "user",
        title: "User",
        primaryId: slurmUserId,
        fields: [{ key: "User ID", value: slurmUserId }],
      });
    }

    const membershipId = readAttr(span, "slurm.membership_id");
    if (membershipId) {
      push({
        kind: "membership",
        title: "Membership",
        primaryId: membershipId,
        fields: [{ key: "Membership ID", value: membershipId }],
      });
    }

    const overrideId = readAttr(span, "slurm.override_id");
    if (overrideId) {
      push({
        kind: "override",
        title: "Override",
        primaryId: overrideId,
        fields: [{ key: "Override ID", value: overrideId }],
      });
    }

    const method = readAttr(span, "http.method");
    const route = readAttr(span, "http.route");
    const statusCode = readAttr(span, "http.status_code");
    if (method || route || statusCode) {
      const fields: LinkedEntityField[] = [];
      if (method) fields.push({ key: "Method", value: method });
      if (route) fields.push({ key: "Route", value: route });
      if (statusCode) fields.push({ key: "Status", value: statusCode });
      push({
        kind: "httpRequest",
        title: "HTTP request",
        primaryId: `${method ?? ""} ${route ?? ""}`.trim() || statusCode,
        fields,
      });
    }
  }

  return out;
}
