import { HttpResponse, http } from "msw";
import { seed } from "../seed";
import { path, paginate } from "./_utils";

export const changeRequestHandlers = [
  http.get(path("/compute-allocations/:id/change-requests"), ({ params, request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let rows = seed.changeRequests.filter((c) => c.compute_allocation_id === params.id);
    if (status) rows = rows.filter((c) => c.change_status === status);
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(path("/compute-allocation-change-requests/:id/events"), ({ params, request }) => {
    const url = new URL(request.url);
    const rows = seed.changeRequestEvents.filter(
      (e) => e.compute_allocation_change_request_id === params.id,
    );
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(path("/compute-allocation-change-requests/:id"), ({ params }) => {
    const req = seed.changeRequests.find((c) => c.id === params.id);
    if (!req) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(req);
  }),

  http.get(path("/users/:id/change-requests"), ({ params, request }) => {
    const url = new URL(request.url);
    const rows = seed.changeRequests.filter((c) => c.requester_id === params.id);
    return HttpResponse.json(paginate(rows, url));
  }),
];
