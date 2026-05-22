import { http, HttpResponse } from "msw";
import { seed } from "../seed";
import { path } from "./_utils";

export const jobsHandlers = [
  // `GET /jobs?user_id&from&to&limit` — researcher recent-jobs table source.
  // Sort: started_at desc; limit applies post-filter.
  http.get(path("/jobs"), ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Number(url.searchParams.get("limit") ?? "0");
    const fromMs = from ? Date.parse(from) : null;
    const toMs = to ? Date.parse(to) : null;
    let rows = seed.jobs.slice();
    if (userId) rows = rows.filter((j) => j.user_id === userId);
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

  // `GET /queues/wait-time?from&to&group_by=queue` — researcher wait-time bars.
  // v1 ignores the range params (seed is static); contract still accepts them
  // so the real backend can implement bucket-by-window without portal changes.
  http.get(path("/queues/wait-time"), () => {
    return HttpResponse.json(seed.queueWaitTimes);
  }),
];
