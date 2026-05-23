import { http, HttpResponse } from "msw";
import { z } from "zod";
import {
  createProjectPayloadSchema,
  projectListEnvelopeSchema,
  projectUsageSummarySchema,
  updateProjectStatusPayloadSchema,
} from "@features/projects/schemas";
import { getProjectsForUserSeed, persistSeed, seed } from "../seed";
import { path } from "./_utils";

// Query-param contract for GET /projects?paged=1 — kept narrow on purpose so
// the MSW handler rejects malformed requests the same way a Zod-strict
// backend would.
const listProjectsQuerySchema = z.object({
  paged: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  pi_id: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]).optional(),
  q: z.string().optional(),
});

export const projectHandlers = [
  // GET /projects has two modes: legacy autocomplete (bare array, `q` only)
  // and paged list (`paged=1`, returns `{items,total}`). Both live here so
  // the contract is in one file. The `paged` discriminator lets the real
  // backend keep one route too.
  http.get(path("/projects"), ({ request }) => {
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const parsed = listProjectsQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { paged, limit, offset, pi_id, status, q } = parsed.data;

    // Legacy autocomplete — no `paged` flag. Returns up to `limit` rows
    // matching `q` against id/originated_id/title; empty `q` returns [].
    if (paged !== "1") {
      const needle = (q ?? "").trim().toLowerCase();
      if (!needle) return HttpResponse.json([]);
      const rows = seed.projects.filter((p) => {
        const haystack = `${p.id} ${p.originated_id} ${p.title}`.toLowerCase();
        return haystack.includes(needle);
      });
      return HttpResponse.json(rows.slice(0, limit ?? 20));
    }

    // Paged mode.
    const needle = (q ?? "").trim().toLowerCase();
    const filtered = seed.projects.filter((p) => {
      if (pi_id && p.project_pi_id !== pi_id) return false;
      if (status && p.status !== status) return false;
      if (needle) {
        const haystack = `${p.id} ${p.originated_id} ${p.title}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    const start = offset ?? 0;
    const end = start + (limit ?? 20);
    const envelope = { items: filtered.slice(start, end), total: filtered.length };
    // Validate before returning so MSW catches any contract drift early.
    return HttpResponse.json(projectListEnvelopeSchema.parse(envelope));
  }),

  http.post(path("/projects"), async ({ request }) => {
    const body = await request.json();
    const parsed = createProjectPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const id = `project-${String(seed.projects.length + 1).padStart(3, "0")}`;
    const project = {
      id,
      originated_id: `MSW-${id}`,
      title: parsed.data.title,
      origination: parsed.data.origination,
      project_pi_id: parsed.data.project_pi_id,
      status: "ACTIVE" as const,
      created_time: new Date().toISOString(),
    };
    seed.projects.push(project);
    persistSeed();
    return HttpResponse.json(project);
  }),

  http.get(path("/projects/:id"), ({ params }) => {
    const project = seed.projects.find((p) => p.id === params.id);
    if (!project) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(project);
  }),

  http.put(path("/projects/:id/status"), async ({ params, request }) => {
    const project = seed.projects.find((p) => p.id === params.id);
    if (!project) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const body = await request.json();
    const parsed = updateProjectStatusPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    project.status = parsed.data.status;
    persistSeed();
    return HttpResponse.json(project);
  }),

  http.get(path("/projects/:id/compute-allocations"), ({ params }) => {
    const allocations = seed.allocations.filter((a) => a.project_id === params.id);
    return HttpResponse.json(allocations);
  }),

  // Mock-only — spec §8 B8. Aggregates seed.usages over the request range,
  // bucketed by allocation/resource/member. Real backend will replace.
  http.get(path("/projects/:id/usage-summary"), ({ params, request }) => {
    const url = new URL(request.url);
    const fromRaw = url.searchParams.get("from");
    const toRaw = url.searchParams.get("to");
    if (!fromRaw || !toRaw) {
      return HttpResponse.json(
        { error: "invalid_request", issues: { from: "required", to: "required" } },
        { status: 400 },
      );
    }
    const fromMs = Date.parse(fromRaw);
    const toMs = Date.parse(toRaw);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
      return HttpResponse.json(
        { error: "invalid_request", issues: { range: "invalid" } },
        { status: 400 },
      );
    }
    const projectId = params.id as string;
    const projectAllocs = seed.allocations.filter((a) => a.project_id === projectId);
    const allocIds = new Set(projectAllocs.map((a) => a.id));
    const usages = seed.usages.filter((u) => {
      if (!allocIds.has(u.compute_allocation_id)) return false;
      const t = Date.parse(u.last_updated);
      return !Number.isNaN(t) && t >= fromMs && t <= toMs;
    });

    const totalAllocated = projectAllocs.reduce((acc, a) => acc + a.initial_su_amount, 0);
    const totalUsed = usages.reduce((acc, u) => acc + u.used_su_amount, 0);

    const allocations = projectAllocs.map((a) => {
      const usedSu = usages
        .filter((u) => u.compute_allocation_id === a.id)
        .reduce((acc, u) => acc + u.used_su_amount, 0);
      return {
        allocation_id: a.id,
        allocation_name: a.name,
        allocated_su: a.initial_su_amount,
        used_su: usedSu,
      };
    });

    const byResourceMap = new Map<string, { resource_id: string; resource_name: string; resource_type: string; used_su: number }>();
    for (const u of usages) {
      const resource = seed.resources.find((r) => r.id === u.compute_allocation_resource_id);
      if (!resource) continue;
      const key = resource.id;
      const existing = byResourceMap.get(key) ?? {
        resource_id: resource.id,
        resource_name: resource.name,
        resource_type: resource.resource_type,
        used_su: 0,
      };
      existing.used_su += u.used_su_amount;
      byResourceMap.set(key, existing);
    }
    // Used % is per-resource share of project total to match the
    // most-used-resource callout's stacked bar; resource-level allocated_su
    // isn't modeled in seed so we use share-of-total instead.
    const byResource = Array.from(byResourceMap.values())
      .map((r) => ({
        ...r,
        used_pct: totalUsed > 0 ? Math.round((r.used_su * 1000) / totalUsed) / 10 : 0,
      }))
      .sort((a, b) => b.used_su - a.used_su);

    const byMemberMap = new Map<string, number>();
    for (const u of usages) {
      byMemberMap.set(u.user_id, (byMemberMap.get(u.user_id) ?? 0) + u.used_su_amount);
    }
    const byMember = Array.from(byMemberMap.entries())
      .map(([userId, used_su]) => {
        const user = seed.users.find((u) => u.id === userId);
        const label = user
          ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() || user.email
          : userId;
        return { user_id: userId, user_label: label, used_su };
      })
      .sort((a, b) => b.used_su - a.used_su);

    const summary = {
      project_id: projectId,
      range: { from: fromRaw, to: toRaw },
      total_allocated_su: totalAllocated,
      total_used_su: totalUsed,
      allocations,
      by_resource: byResource,
      by_member: byMember,
    };
    return HttpResponse.json(projectUsageSummarySchema.parse(summary));
  }),

  // Phase 2 portal-only convenience until the backend exposes a "projects
  // where I am PI" endpoint. Documented in docs/backend-contracts/users.md.
  http.get(path("/users/:id/projects-as-pi"), ({ params }) => {
    const projects = seed.projects.filter((p) => p.project_pi_id === params.id);
    return HttpResponse.json(projects);
  }),

  // Spec §8 B2 — membership-derived projects for a user. Researchers consume
  // this for /projects; PIs consume it as their member-projects axis.
  http.get(path("/users/:id/projects"), ({ params }) => {
    const projects = getProjectsForUserSeed(params.id as string);
    return HttpResponse.json(projects);
  }),
];
