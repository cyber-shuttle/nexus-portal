import { http, HttpResponse } from "msw";
import { seed } from "../seed";
import { path } from "./_utils";

export const resourceHandlers = [
  http.get(path("/compute-allocation-resources/:id/rates/effective"), ({ params, request }) => {
    const url = new URL(request.url);
    const atRaw = url.searchParams.get("at");
    const at = atRaw ? Date.parse(atRaw) : Date.now();
    const rates = seed.resourceRates.filter((r) => r.compute_allocation_resource_id === params.id);
    const effective = rates.find(
      (r) => Date.parse(r.start_time) <= at && at <= Date.parse(r.end_time),
    );
    if (!effective) return HttpResponse.json({ error: "no_effective_rate" }, { status: 404 });
    return HttpResponse.json(effective);
  }),

  http.get(path("/compute-allocation-resources/:id"), ({ params }) => {
    const resource = seed.resources.find((r) => r.id === params.id);
    if (!resource) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(resource);
  }),
];
