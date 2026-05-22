import {
  createAdjustmentPayloadSchema,
  createRatePayloadSchema,
  discardUnmappedJobPayloadSchema,
  linkUnmappedJobPayloadSchema,
} from "@features/admin/schemas";
import { http, HttpResponse } from "msw";
import { persistSeed, seed } from "../seed";
import { path } from "./_utils";

function amieFailedWithin24h(): number {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return seed.amiePackets.filter((p) => {
    if (p.status !== "FAILED") return false;
    const t = Date.parse(p.received_at);
    return !Number.isNaN(t) && t >= cutoff;
  }).length;
}

// Exported for unit tests. Half-open `[from, to)` overlap: two windows
// collide iff `aFrom < bTo && bFrom < aTo` — touching boundaries do not
// overlap, matching the contract in docs/backend-contracts/admin.md.
export function findOverlappingRate(
  resourceRates: Array<{
    id: string;
    compute_allocation_resource_id: string;
    start_time: string;
    end_time: string;
  }>,
  candidate: {
    compute_allocation_resource_id: string;
    effective_from: string;
    effective_to: string;
  },
): { id: string } | undefined {
  const newFrom = Date.parse(candidate.effective_from);
  const newTo = Date.parse(candidate.effective_to);
  return resourceRates.find((rr) => {
    if (rr.compute_allocation_resource_id !== candidate.compute_allocation_resource_id) {
      return false;
    }
    const existingFrom = Date.parse(rr.start_time);
    const existingTo = Date.parse(rr.end_time);
    return newFrom < existingTo && existingFrom < newTo;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const NINETY_DAYS = 90 * DAY_MS;

export const adminHandlers = [
  // Phase 2 portal-only endpoint until the backend exposes a `/admin/stats` view.
  // Documented in docs/backend-contracts/admin.md.
  http.get(path("/admin/stats"), () => {
    const now = Date.now();
    const quarterStart = now - NINETY_DAYS;

    const total_projects = seed.projects.length;
    const active_allocations = seed.allocations.filter((a) => a.status === "ACTIVE").length;

    const total_su_allocated_quarter = seed.allocations
      .filter((a) => Date.parse(a.start_time) >= quarterStart)
      .reduce((acc, a) => acc + a.initial_su_amount, 0);

    const total_su_charged_quarter = seed.usages
      .filter((u) => Date.parse(u.last_updated) >= quarterStart)
      .reduce((acc, u) => acc + u.used_su_amount, 0);

    const buckets = new Map<string, number>();
    for (let d = 29; d >= 0; d -= 1) {
      const dayStart = now - d * DAY_MS;
      const key = new Date(dayStart).toISOString().slice(0, 10);
      buckets.set(key, 0);
    }
    for (const a of seed.allocations) {
      const t = Date.parse(a.start_time);
      if (Number.isNaN(t)) continue;
      const key = new Date(t).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const allocations_by_day = Array.from(buckets.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return HttpResponse.json({
      total_projects,
      active_allocations,
      total_su_allocated_quarter,
      total_su_charged_quarter,
      pending_proposals: 4,
      amie_failed_24h: amieFailedWithin24h(),
      allocations_by_day,
    });
  }),

  http.get(path("/admin/change-requests"), ({ request }) => {
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "PENDING")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const rows = seed.changeRequests.filter((cr) => status.includes(cr.change_status));
    return HttpResponse.json(rows.slice(0, limit));
  }),

  http.get(path("/admin/resources"), ({ request }) => {
    const url = new URL(request.url);
    const cluster = url.searchParams.get("cluster");
    const status = url.searchParams.get("status");
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

    const rows = seed.resources.map((r) => {
      const mappings = seed.resourceMappings.filter((m) => m.compute_allocation_resource_id === r.id);
      const allocationIds = new Set(mappings.map((m) => m.compute_allocation_id));
      const allocs = seed.allocations.filter((a) => allocationIds.has(a.id));
      const total_allocated_su = allocs.reduce((acc, a) => acc + a.initial_su_amount, 0);
      const total_used_su = seed.usages
        .filter((u) => u.compute_allocation_resource_id === r.id)
        .reduce((acc, u) => acc + u.used_su_amount, 0);
      const rate_count = seed.resourceRates.filter(
        (rr) => rr.compute_allocation_resource_id === r.id,
      ).length;
      const used_pct =
        total_allocated_su > 0 ? Math.round((total_used_su * 1000) / total_allocated_su) / 10 : 0;
      const clusterId = allocs[0]?.compute_cluster_id ?? seed.clusters[0]?.id ?? "cluster-001";
      const clusterRow = seed.clusters.find((c) => c.id === clusterId) ?? seed.clusters[0];
      const isActive = allocs.some((a) => a.status === "ACTIVE");
      return {
        id: r.id,
        name: r.name,
        resource_type: r.resource_type,
        cluster_id: clusterRow?.id ?? "cluster-001",
        cluster_name: clusterRow?.name ?? "Nexus-A",
        allocation_count: allocationIds.size,
        total_allocated_su,
        total_used_su,
        used_pct,
        rate_count,
        status: isActive ? ("ACTIVE" as const) : ("INACTIVE" as const),
      };
    });

    const filtered = rows.filter((r) => {
      if (cluster && r.cluster_id !== cluster) return false;
      if (status && r.status !== status) return false;
      if (q && !`${r.name} ${r.resource_type}`.toLowerCase().includes(q)) return false;
      return true;
    });
    return HttpResponse.json(filtered);
  }),

  http.get(path("/admin/resources/:id/usage-trend"), ({ params }) => {
    const id = params.id as string;
    const now = Date.now();
    const buckets = new Map<string, number>();
    for (let d = 29; d >= 0; d -= 1) {
      const key = new Date(now - d * DAY_MS).toISOString().slice(0, 10);
      buckets.set(key, 0);
    }
    for (const u of seed.usages) {
      if (u.compute_allocation_resource_id !== id) continue;
      const t = Date.parse(u.last_updated);
      if (Number.isNaN(t)) continue;
      const key = new Date(t).toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + u.used_su_amount);
    }
    const points = Array.from(buckets.entries()).map(([date, used_su]) => ({ date, used_su }));
    return HttpResponse.json(points);
  }),

  http.get(path("/admin/rates"), () => {
    const rows = seed.resourceRates.map((rr) => {
      const resource = seed.resources.find((r) => r.id === rr.compute_allocation_resource_id);
      const mapping = seed.resourceMappings.find(
        (m) => m.compute_allocation_resource_id === rr.compute_allocation_resource_id,
      );
      const alloc = mapping
        ? seed.allocations.find((a) => a.id === mapping.compute_allocation_id)
        : undefined;
      const clusterRow = seed.clusters.find((c) => c.id === alloc?.compute_cluster_id);
      const now = Date.now();
      const active = Date.parse(rr.start_time) <= now && now <= Date.parse(rr.end_time);
      return {
        id: rr.id,
        compute_allocation_resource_id: rr.compute_allocation_resource_id,
        resource_name: resource?.name ?? "unknown",
        cluster_name: clusterRow?.name ?? "—",
        rate: Number(rr.rate.toFixed(3)),
        effective_from: rr.start_time,
        effective_to: rr.end_time,
        active,
      };
    });
    return HttpResponse.json(rows);
  }),

  http.post(path("/admin/rates"), async ({ request }) => {
    const body = await request.json();
    const parsed = createRatePayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    // Reject creates that overlap an existing rate window for the same resource.
    // Spec §11 Phase 7 — non-overlapping constraint; documented in
    // docs/backend-contracts/admin.md as 409 rate_overlaps_existing.
    const conflict = findOverlappingRate(seed.resourceRates, parsed.data);
    if (conflict) {
      return HttpResponse.json(
        { error: "rate_overlaps_existing", existing_rate_id: conflict.id },
        { status: 409 },
      );
    }
    const newId = `${parsed.data.compute_allocation_resource_id}-rate-${seed.resourceRates.length + 1}`;
    const newRate = {
      id: newId,
      compute_allocation_resource_id: parsed.data.compute_allocation_resource_id,
      rate: parsed.data.rate,
      start_time: parsed.data.effective_from,
      end_time: parsed.data.effective_to,
    };
    seed.resourceRates.push(newRate);
    persistSeed();
    const resource = seed.resources.find((r) => r.id === newRate.compute_allocation_resource_id);
    return HttpResponse.json({
      id: newRate.id,
      compute_allocation_resource_id: newRate.compute_allocation_resource_id,
      resource_name: resource?.name ?? "unknown",
      cluster_name: "—",
      rate: newRate.rate,
      effective_from: newRate.start_time,
      effective_to: newRate.end_time,
      active: Date.parse(newRate.start_time) <= Date.now(),
    });
  }),

  http.post(path("/admin/rates/:id/deactivate"), ({ params }) => {
    const id = params.id as string;
    const rr = seed.resourceRates.find((r) => r.id === id);
    if (!rr) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    rr.end_time = new Date().toISOString();
    persistSeed();
    const resource = seed.resources.find((r) => r.id === rr.compute_allocation_resource_id);
    return HttpResponse.json({
      id: rr.id,
      compute_allocation_resource_id: rr.compute_allocation_resource_id,
      resource_name: resource?.name ?? "unknown",
      cluster_name: "—",
      rate: rr.rate,
      effective_from: rr.start_time,
      effective_to: rr.end_time,
      active: false,
    });
  }),

  http.get(path("/admin/allocations"), ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const status = url.searchParams.get("status");
    const limit = Number(url.searchParams.get("limit") ?? "50");
    const rows = seed.allocations
      .filter((a) => (status ? a.status === status : true))
      .filter((a) => (q ? `${a.id} ${a.name}`.toLowerCase().includes(q) : true))
      .slice(0, limit)
      .map((a) => ({ id: a.id, name: a.name, status: a.status }));
    return HttpResponse.json(rows);
  }),

  http.get(path("/admin/unmapped-jobs"), () => {
    return HttpResponse.json(seed.unmappedJobs);
  }),

  http.post(path("/admin/unmapped-jobs/:id/link"), async ({ params, request }) => {
    const id = params.id as string;
    const job = seed.unmappedJobs.find((j) => j.id === id);
    if (!job) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const body = await request.json();
    const parsed = linkUnmappedJobPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const alloc = seed.allocations.find((a) => a.id === parsed.data.allocation_id);
    if (!alloc) {
      return HttpResponse.json(
        { error: "allocation_not_found", allocation_id: parsed.data.allocation_id },
        { status: 404 },
      );
    }
    const idx = seed.unmappedJobs.findIndex((j) => j.id === id);
    if (idx >= 0) seed.unmappedJobs.splice(idx, 1);
    persistSeed();
    return HttpResponse.json(job);
  }),

  http.post(path("/admin/unmapped-jobs/:id/discard"), async ({ params, request }) => {
    const id = params.id as string;
    const body = await request.json();
    const parsed = discardUnmappedJobPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const idx = seed.unmappedJobs.findIndex((j) => j.id === id);
    if (idx === -1) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    seed.unmappedJobs.splice(idx, 1);
    persistSeed();
    return HttpResponse.json({ ok: true });
  }),

  http.get(path("/admin/adjustments"), ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    const allocationId = url.searchParams.get("allocation_id");
    const rows = seed.adjustments
      .filter((a) => (type ? a.type === type : true))
      .filter((a) => (allocationId ? a.allocation_id === allocationId : true));
    return HttpResponse.json(rows);
  }),

  http.post(path("/admin/adjustments"), async ({ request }) => {
    const body = await request.json();
    const parsed = createAdjustmentPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const alloc = seed.allocations.find((a) => a.id === parsed.data.allocation_id);
    if (!alloc) {
      return HttpResponse.json(
        { error: "allocation_not_found", allocation_id: parsed.data.allocation_id },
        { status: 404 },
      );
    }
    const id = `adj-${String(seed.adjustments.length + 1).padStart(3, "0")}`;
    const row = {
      id,
      allocation_id: alloc.id,
      allocation_name: alloc.name,
      type: parsed.data.type,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      created_by: "admin@nexus.local",
      created_at: new Date().toISOString(),
    };
    seed.adjustments.unshift(row);
    persistSeed();
    return HttpResponse.json(row);
  }),
];
