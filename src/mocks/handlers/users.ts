import { HttpResponse, http } from "msw";
import { seed } from "../seed";
import { path } from "./_utils";

export const userHandlers = [
  http.get(path("/users/:id"), ({ params }) => {
    const user = seed.users.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(user);
  }),

  http.get(path("/projects/:id"), ({ params }) => {
    const project = seed.projects.find((p) => p.id === params.id);
    if (!project) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(project);
  }),
];
