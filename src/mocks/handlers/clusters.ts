import { http, HttpResponse } from "msw";
import { z } from "zod";
import {
  clusterSchema,
  updateClusterStatusPayloadSchema,
} from "@features/admin/schemas";
import { persistSeed, seed } from "../seed";
import { path } from "./_utils";

const listClustersQuerySchema = z.object({
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
});

// Derive the admin-facing cluster row from the minimal seed shape. We
// compute allocation_count + user_count fresh per request so post-disable
// the counts still reflect existing allocations (disable hides from
// selectors only — see spec §5.4).
function buildClusterRow(clusterId: string, clusterName: string, status: "ENABLED" | "DISABLED") {
  const allocs = seed.allocations.filter((a) => a.compute_cluster_id === clusterId);
  const allocIds = new Set(allocs.map((a) => a.id));
  const userIds = new Set(
    seed.memberships.filter((m) => allocIds.has(m.compute_allocation_id)).map((m) => m.user_id),
  );
  return clusterSchema.parse({
    id: clusterId,
    name: clusterName,
    status,
    // Placeholder type/location — real backend will carry these on the row.
    type: "Compute",
    location: clusterName,
    allocation_count: allocs.length,
    user_count: userIds.size,
  });
}

export const clusterHandlers = [
  // GET /compute-clusters?status=ENABLED — spec §8 B6. When `status` is
  // omitted, returns every cluster (admin Clusters tab default view).
  http.get(path("/compute-clusters"), ({ request }) => {
    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams.entries());
    const parsed = listClustersQuerySchema.safeParse(raw);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const rows = seed.clusters
      .filter((c) => {
        // Default both unspecified and known-enabled to ENABLED for legacy
        // seed entries — only the explicit DISABLED rows are filtered out
        // when the caller asks for ENABLED-only.
        const status = (c.status ?? "ENABLED") as "ENABLED" | "DISABLED";
        if (parsed.data.status && status !== parsed.data.status) return false;
        return true;
      })
      .map((c) => buildClusterRow(c.id, c.name, (c.status ?? "ENABLED") as "ENABLED" | "DISABLED"));
    return HttpResponse.json(rows);
  }),

  // PATCH /compute-clusters/{id} body { status } — spec §8 B5. Mutates the
  // in-memory seed cluster + persists for HMR/reload survival. Returns the
  // updated row in the admin shape.
  http.patch(path("/compute-clusters/:id"), async ({ params, request }) => {
    const cluster = seed.clusters.find((c) => c.id === params.id);
    if (!cluster) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const body = await request.json();
    const parsed = updateClusterStatusPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    cluster.status = parsed.data.status;
    persistSeed();
    return HttpResponse.json(buildClusterRow(cluster.id, cluster.name, parsed.data.status));
  }),
];
