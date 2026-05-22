import { HttpResponse, http } from "msw";
import { seed } from "../seed";
import { amieFailed24h } from "../seed/amie-packets";
import { path } from "./_utils";

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
      amie_failed_24h: amieFailed24h(),
      allocations_by_day,
    });
  }),

  http.get(path("/admin/change-requests"), () => {
    const pending = seed.changeRequests.filter((cr) => cr.change_status === "PENDING");
    return HttpResponse.json(pending.slice(0, 50));
  }),
];
