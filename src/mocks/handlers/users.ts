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

  // Phase 2 portal-only convenience until the backend exposes a "projects
  // where I am PI" endpoint. Documented in docs/backend-contracts/users.md.
  http.get(path("/users/:id/projects-as-pi"), ({ params }) => {
    const projects = seed.projects.filter((p) => p.project_pi_id === params.id);
    return HttpResponse.json(projects);
  }),

  http.get(path("/projects/:id/compute-allocations"), ({ params }) => {
    const allocations = seed.allocations.filter((a) => a.project_id === params.id);
    return HttpResponse.json(allocations);
  }),
];
