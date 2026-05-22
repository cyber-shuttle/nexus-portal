import { http, HttpResponse } from "msw";
import { getAllocationUsageTotalRow, getAllocationUserUsageTotalRow, seed } from "../seed";
import { path, paginate } from "./_utils";

export const allocationHandlers = [
  http.get(path("/compute-allocations/:id"), ({ params }) => {
    const allocation = seed.allocations.find((a) => a.id === params.id);
    if (!allocation) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(allocation);
  }),

  http.get(path("/compute-allocations/:id/resources"), ({ params, request }) => {
    const allocId = params.id as string;
    const mappingIds = new Set(
      seed.resourceMappings
        .filter((m) => m.compute_allocation_id === allocId)
        .map((m) => m.compute_allocation_resource_id),
    );
    const resources = seed.resources.filter((r) => mappingIds.has(r.id));
    return HttpResponse.json(paginate(resources, new URL(request.url)));
  }),

  http.get(path("/compute-allocations/:id/usages/total"), ({ params }) => {
    return HttpResponse.json(getAllocationUsageTotalRow(params.id as string));
  }),

  http.get(path("/compute-allocations/:id/users/:userId/usages/total"), ({ params }) => {
    return HttpResponse.json(
      getAllocationUserUsageTotalRow(params.id as string, params.userId as string),
    );
  }),

  http.get(path("/compute-allocations/:id/usages"), ({ params, request }) => {
    const url = new URL(request.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    let usages = seed.usages.filter((u) => u.compute_allocation_id === params.id);
    if (from) {
      const fromMs = Date.parse(from);
      usages = usages.filter((u) => Date.parse(u.last_updated) >= fromMs);
    }
    if (to) {
      const toMs = Date.parse(to);
      usages = usages.filter((u) => Date.parse(u.last_updated) <= toMs);
    }
    usages.sort((a, b) => (a.last_updated < b.last_updated ? 1 : -1));
    return HttpResponse.json(paginate(usages, url));
  }),
];
