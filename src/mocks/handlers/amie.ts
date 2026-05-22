import { linkUnmappedPayloadSchema, resolvePacketPayloadSchema } from "@features/amie/schemas";
import type { Packet, PacketEvent, PacketStatBucket } from "@features/amie/types";
import { http, HttpResponse } from "msw";
import { persistSeed, seed } from "../seed";
import { path } from "./_utils";

function pageWindow<T>(items: T[], url: URL): { rows: T[]; limit: number; offset: number } {
  const limit = Math.max(0, Number(url.searchParams.get("limit") ?? "0"));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const rows = limit > 0 ? items.slice(offset, offset + limit) : items.slice(offset);
  return { rows, limit, offset };
}

function matchStatus(packet: Packet, statusParam: string | null): boolean {
  if (!statusParam || statusParam === "all") return true;
  const wanted = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return wanted.length === 0 || wanted.includes(packet.status);
}

function matchType(packet: Packet, typeParam: string | null): boolean {
  if (!typeParam || typeParam === "all") return true;
  const wanted = typeParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return wanted.length === 0 || wanted.includes(packet.type);
}

function matchSource(packet: Packet, sourceParam: string | null): boolean {
  if (!sourceParam || sourceParam === "all") return true;
  return packet.source === sourceParam;
}

function matchWindow(receivedAt: string, from: string | null, to: string | null): boolean {
  const ts = Date.parse(receivedAt);
  if (Number.isNaN(ts)) return true;
  if (from) {
    const f = Date.parse(from);
    if (!Number.isNaN(f) && ts < f) return false;
  }
  if (to) {
    const t = Date.parse(to);
    if (!Number.isNaN(t) && ts > t) return false;
  }
  return true;
}

function newId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${rand.slice(0, 8)}`;
}

function appendEvent(packetId: string, partial: Omit<PacketEvent, "id" | "packet_id">): void {
  seed.amieEvents.push({
    id: newId(`${packetId}-evt`),
    packet_id: packetId,
    ...partial,
  });
}

export const amieHandlers = [
  http.get(path("/amie/packets"), ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const source = url.searchParams.get("source");
    const q = url.searchParams.get("q");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let rows = seed.amiePackets.slice().sort((a, b) => b.received_at.localeCompare(a.received_at));

    rows = rows.filter((p) => matchStatus(p, status));
    rows = rows.filter((p) => matchType(p, type));
    rows = rows.filter((p) => matchSource(p, source));
    rows = rows.filter((p) => matchWindow(p.received_at, from, to));
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.amie_id.toLowerCase().includes(needle) ||
          p.id.toLowerCase().includes(needle) ||
          (p.linked_entity?.id ?? "").toLowerCase().includes(needle),
      );
    }

    const total = rows.length;
    const page = pageWindow(rows, url);
    return HttpResponse.json({
      packets: page.rows,
      total,
      limit: page.limit,
      offset: page.offset,
    });
  }),

  http.get(path("/amie/packets/:id"), ({ params }) => {
    const row = seed.amiePackets.find((p) => p.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(row);
  }),

  http.get(path("/amie/packets/:id/events"), ({ params }) => {
    const rows = seed.amieEvents
      .filter((e) => e.packet_id === params.id)
      .slice()
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    return HttpResponse.json(rows);
  }),

  http.post(path("/amie/packets/:id/retry"), ({ params }) => {
    const row = seed.amiePackets.find((p) => p.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const now = new Date().toISOString();
    row.retries += 1;
    row.updated_at = now;
    // Retries flip a FAILED back to DECODED, awaiting a fresh handler attempt.
    if (row.status === "FAILED") {
      row.status = "DECODED";
      row.last_error = undefined;
    }
    appendEvent(row.id, {
      event_type: "RETRY_SCHEDULED",
      actor: "admin@nexus.local",
      status: "RUNNING",
      message: "Admin queued a manual retry",
      timestamp: now,
    });
    persistSeed();
    return HttpResponse.json({ queued: true, packet: row });
  }),

  http.post(path("/amie/packets/:id/resolve"), async ({ params, request }) => {
    const row = seed.amiePackets.find((p) => p.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = resolvePacketPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    row.status = "PROCESSED";
    row.last_error = undefined;
    row.processed_at = now;
    row.updated_at = now;
    appendEvent(row.id, {
      event_type: "MANUAL_RESOLVE",
      actor: "admin@nexus.local",
      status: "SUCCEEDED",
      message: parsed.data.reason,
      timestamp: now,
    });
    persistSeed();
    return HttpResponse.json(row);
  }),

  http.get(path("/amie/replies"), ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    let rows = seed.amieReplies.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (status && status !== "all") {
      const wanted = status
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      rows = rows.filter((r) => wanted.includes(r.status));
    }
    rows = rows.filter((r) => matchWindow(r.created_at, from, to));

    const total = rows.length;
    const page = pageWindow(rows, url);
    return HttpResponse.json({
      replies: page.rows,
      total,
      limit: page.limit,
      offset: page.offset,
    });
  }),

  http.post(path("/amie/replies/:id/retry"), ({ params }) => {
    const row = seed.amieReplies.find((r) => r.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    row.retries += 1;
    if (row.status === "FAILED") {
      row.status = "PENDING";
      row.last_error = undefined;
    }
    persistSeed();
    return HttpResponse.json({ queued: true });
  }),

  http.get(path("/amie/unmapped"), ({ request }) => {
    const url = new URL(request.url);
    const rows = seed.amiePackets
      .filter((p) => p.status === "DECODED" && !p.linked_entity)
      .slice()
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
    const total = rows.length;
    const page = pageWindow(rows, url);
    return HttpResponse.json({
      packets: page.rows,
      total,
      limit: page.limit,
      offset: page.offset,
    });
  }),

  http.post(path("/amie/unmapped/:id/link"), async ({ params, request }) => {
    const row = seed.amiePackets.find((p) => p.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = linkUnmappedPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (parsed.data.entity_type === "project") {
      const match = seed.projects.find(
        (p) => p.id === parsed.data.entity_id || p.originated_id === parsed.data.entity_id,
      );
      if (!match) {
        return HttpResponse.json(
          { error: "entity_not_found", entity_type: "project", entity_id: parsed.data.entity_id },
          { status: 404 },
        );
      }
    }
    const now = new Date().toISOString();
    row.linked_entity = {
      type: parsed.data.entity_type,
      id: parsed.data.entity_id,
      display_id: parsed.data.entity_id,
    };
    row.status = "PROCESSED";
    row.processed_at = now;
    row.updated_at = now;
    appendEvent(row.id, {
      event_type: "MANUAL_LINK",
      actor: "admin@nexus.local",
      status: "SUCCEEDED",
      message: `Linked to ${parsed.data.entity_type} ${parsed.data.entity_id}`,
      timestamp: now,
    });
    persistSeed();
    return HttpResponse.json(row);
  }),

  http.get(path("/amie/stats"), ({ request }) => {
    const url = new URL(request.url);
    const window = url.searchParams.get("window") ?? "30d";
    const days = Number(window.replace("d", "")) || 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const buckets = new Map<string, PacketStatBucket>();
    for (const p of seed.amiePackets) {
      const ts = Date.parse(p.received_at);
      if (Number.isNaN(ts) || ts < cutoff) continue;
      const date = new Date(ts).toISOString().slice(0, 10);
      const key = `${date}|${p.status}|${p.type}`;
      const existing = buckets.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        buckets.set(key, { date, status: p.status, type: p.type, count: 1 });
      }
    }
    const byDay = Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
    return HttpResponse.json({ byDay });
  }),
];
