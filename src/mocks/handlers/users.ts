import { updatePreferencesPayloadSchema } from "@features/auth/schemas";
import { http, HttpResponse } from "msw";
import { derivePersonaScopes } from "@/shared/auth/personaScopes";
import { persistSeed, seed } from "../seed";
import { path } from "./_utils";

const DEFAULT_PREFS = {
  timezone: "UTC",
  notify_on_change_request_decided: true,
  notify_on_proposal_decided: true,
};

function currentUserId(request: Request): string {
  const url = new URL(request.url);
  return (
    url.searchParams.get("user") ??
    request.headers.get("x-nexus-user") ??
    "researcher@nexus.local"
  );
}

export const userHandlers = [
  http.get(path("/me/preferences"), ({ request }) => {
    const userId = currentUserId(request);
    const existing = seed.preferences[userId] ?? DEFAULT_PREFS;
    return HttpResponse.json({ user_id: userId, ...existing });
  }),

  http.put(path("/me/preferences"), async ({ request }) => {
    const userId = currentUserId(request);
    const body = await request.json();
    const parsed = updatePreferencesPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    seed.preferences[userId] = parsed.data;
    persistSeed();
    return HttpResponse.json({ user_id: userId, ...parsed.data });
  }),

  http.get(path("/me/identities"), ({ request }) => {
    const userId = currentUserId(request);
    return HttpResponse.json(seed.identities.filter((i) => i.user_id === userId));
  }),

  // Phase 7 portal-only fallback for OIDC scope mapping; documented in
  // docs/backend-contracts/auth.md. The portal hits /me/scopes if the OIDC
  // token didn't carry a `nexus_role` or `nexus_admin` claim.
  http.get(path("/me/scopes"), ({ request }) => {
    const url = new URL(request.url);
    const userId = url.searchParams.get("user") ?? "researcher@nexus.local";
    const scopes = derivePersonaScopes(userId);
    const isAdmin = userId === "admin@nexus.local";
    const isPi = userId === "pi@nexus.local";
    return HttpResponse.json({
      role: isAdmin ? "admin" : isPi ? "pi" : "user",
      myPiAllocations: scopes.myPiAllocations,
      assignedAllocations: scopes.assignedAllocations,
    });
  }),

  // Phase 3 portal-only autocomplete; documented in docs/backend-contracts/users.md.
  // Must come before /users/:id so the "search" route doesn't get captured by :id.
  http.get(path("/users"), ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const limit = Number(url.searchParams.get("limit") ?? "20");
    if (!q) return HttpResponse.json([]);
    const rows = seed.users.filter((u) => {
      const haystack = `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase();
      return haystack.includes(q);
    });
    return HttpResponse.json(rows.slice(0, limit));
  }),

  http.get(path("/users/:id"), ({ params }) => {
    const user = seed.users.find((u) => u.id === params.id);
    if (!user) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(user);
  }),

  // Phase 7 portal-only autocomplete for the AMIE reconciliation queue;
  // documented in docs/backend-contracts/users.md. Must come before
  // /projects/:id so the "search" route doesn't get captured by :id.
  http.get(path("/projects"), ({ request }) => {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const limit = Number(url.searchParams.get("limit") ?? "20");
    if (!q) return HttpResponse.json([]);
    const rows = seed.projects.filter((p) => {
      const haystack = `${p.id} ${p.originated_id} ${p.title}`.toLowerCase();
      return haystack.includes(q);
    });
    return HttpResponse.json(rows.slice(0, limit));
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
