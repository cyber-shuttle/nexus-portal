import { http, HttpResponse } from "msw";
import { seed } from "../seed";
import { path } from "./_utils";

// Projects own allocations; allocations own jobs. The `project_id` query filter
// resolves to the union of the project's allocation IDs so PI analytics can
// scope wait-time + jobs to projects they lead without a separate endpoint.
function allocationIdsForProject(projectId: string): Set<string> {
  return new Set(
    seed.allocations.filter((a) => a.project_id === projectId).map((a) => a.id),
  );
}

export const jobsHandlers = [
  // `GET /jobs?user_id&project_id&from&to&limit` — researcher + PI table source.
  // Sort: started_at desc; limit applies post-filter.
  http.get(path("/jobs"), ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    const projectId = url.searchParams.get("project_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Number(url.searchParams.get("limit") ?? "0");
    const fromMs = from ? Date.parse(from) : null;
    const toMs = to ? Date.parse(to) : null;
    let rows = seed.jobs.slice();
    if (userId) rows = rows.filter((j) => j.user_id === userId);
    if (projectId) {
      const allocs = allocationIdsForProject(projectId);
      rows = rows.filter((j) => allocs.has(j.allocation_id));
    }
    if (fromMs !== null && !Number.isNaN(fromMs)) {
      rows = rows.filter((j) => Date.parse(j.started_at) >= fromMs);
    }
    if (toMs !== null && !Number.isNaN(toMs)) {
      rows = rows.filter((j) => Date.parse(j.started_at) <= toMs);
    }
    rows.sort((a, b) => (a.started_at < b.started_at ? 1 : -1));
    if (limit > 0) rows = rows.slice(0, limit);
    return HttpResponse.json(rows);
  }),

  // `GET /queues/wait-time?from&to&project_id&group_by=queue` — wait-time bars.
  // v1 ignores from/to (seed is static); `project_id` filters jobs to the
  // project's allocations and rebuilds avg per queue from those jobs only.
  // When no project filter is set we return the pre-baked queue stats.
  http.get(path("/queues/wait-time"), ({ request }) => {
    const url = new URL(request.url);
    const projectId = url.searchParams.get("project_id");
    if (!projectId) return HttpResponse.json(seed.queueWaitTimes);
    const allocs = allocationIdsForProject(projectId);
    const scoped = seed.jobs.filter((j) => allocs.has(j.allocation_id));
    // Resource id stands in for queue here — seed has no queue field on jobs.
    // Documented in docs/backend-contracts/analytics.md; real backend keys on queue.
    const byQueue = new Map<string, number[]>();
    for (const j of scoped) {
      const k = j.resource_id;
      const arr = byQueue.get(k) ?? [];
      arr.push(j.wait_seconds);
      byQueue.set(k, arr);
    }
    const rows = Array.from(byQueue.entries()).map(([queue, waits]) => {
      const sorted = waits.slice().sort((a, b) => a - b);
      const pick = (q: number) =>
        sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
      const avg = Math.round(waits.reduce((acc, w) => acc + w, 0) / Math.max(1, waits.length));
      return {
        queue,
        avg_wait_seconds: avg,
        p50: pick(0.5),
        p90: pick(0.9),
        sample_size: waits.length,
      };
    });
    return HttpResponse.json(rows);
  }),
];
