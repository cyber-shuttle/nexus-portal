import { HttpResponse, http } from "msw";
import { seed } from "../seed";
import { path, paginate } from "./_utils";

export const diffHandlers = [
  http.get(path("/compute-allocations/:id/diffs"), ({ params, request }) => {
    const url = new URL(request.url);
    const rows = seed.diffs.filter((d) => d.compute_allocation_id === params.id);
    rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(path("/compute-allocations/:id/diffs/latest"), ({ params }) => {
    const rows = seed.diffs.filter((d) => d.compute_allocation_id === params.id);
    rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    const latest = rows[0];
    if (!latest) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(latest);
  }),

  http.get(path("/compute-allocation-diffs/:id"), ({ params }) => {
    const diff = seed.diffs.find((d) => d.id === params.id);
    if (!diff) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(diff);
  }),
];
