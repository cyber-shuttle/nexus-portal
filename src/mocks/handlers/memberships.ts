import { HttpResponse, http } from "msw";
import { seed } from "../seed";
import { path, paginate } from "./_utils";

export const membershipHandlers = [
  http.get(path("/compute-allocations/:id/memberships"), ({ params, request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    let rows = seed.memberships.filter((m) => m.compute_allocation_id === params.id);
    if (status) rows = rows.filter((m) => m.membership_status === status);
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(path("/users/:id/compute-allocation-memberships"), ({ params, request }) => {
    const url = new URL(request.url);
    const rows = seed.memberships.filter((m) => m.user_id === params.id);
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(path("/compute-allocation-memberships/:id"), ({ params }) => {
    const membership = seed.memberships.find((m) => m.id === params.id);
    if (!membership) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(membership);
  }),

  http.get(
    path("/compute-allocation-memberships/:id/resource-overrides"),
    ({ params, request }) => {
      const url = new URL(request.url);
      const rows = seed.overrides.filter((o) => o.compute_allocation_membership_id === params.id);
      return HttpResponse.json(paginate(rows, url));
    },
  ),
];
