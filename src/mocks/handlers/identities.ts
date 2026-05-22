import { http, HttpResponse } from "msw";
import { seed } from "../seed";
import { path } from "./_utils";

export const identityHandlers = [
  http.get(path("/users/:id/user-identities"), ({ params }) => {
    const rows = seed.identities.filter((i) => i.user_id === params.id);
    return HttpResponse.json(rows);
  }),

  http.get(path("/user-identities/:id"), ({ params }) => {
    const identity = seed.identities.find((i) => i.id === params.id);
    if (!identity) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(identity);
  }),
];
