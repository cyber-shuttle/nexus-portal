import {
  createMembershipPayloadSchema,
  overridePayloadSchema,
  updateMembershipPayloadSchema,
} from "@features/members/api";
import type {
  ComputeAllocationMembership,
  ComputeAllocationMembershipResourceOverride,
} from "@features/members/schemas";
import { http, HttpResponse } from "msw";
import { z } from "zod";
import { persistSeed, seed } from "../seed";
import { aliasUserId, path, paginate } from "./_utils";

const statusUpdateSchema = z.object({
  membership_status: z.enum(["ACTIVE", "INACTIVE", "DELETED"]),
});

const overridePatchSchema = overridePayloadSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "patch is empty" });

function newId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${rand.slice(0, 8)}`;
}

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
    const userId = aliasUserId(params.id as string);
    const rows = seed.memberships.filter((m) => m.user_id === userId);
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

  http.post(path("/compute-allocation-memberships"), async ({ request }) => {
    const parsed = createMembershipPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const allocation = seed.allocations.find((a) => a.id === body.compute_allocation_id);
    const start = body.start_time ?? allocation?.start_time ?? new Date().toISOString();
    const end = body.end_time ?? allocation?.end_time ?? new Date().toISOString();
    const created: ComputeAllocationMembership = {
      id: newId(`${body.compute_allocation_id}-mem`),
      compute_allocation_id: body.compute_allocation_id,
      user_id: body.user_id,
      start_time: start,
      end_time: end,
      membership_status: body.membership_status ?? "ACTIVE",
    };
    seed.memberships.push(created);
    if (body.portal_role) seed.membershipRoles[created.id] = body.portal_role;
    persistSeed();
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(path("/compute-allocation-memberships/:id/status"), async ({ params, request }) => {
    const existing = seed.memberships.find((m) => m.id === params.id);
    if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = statusUpdateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    existing.membership_status = parsed.data.membership_status;
    persistSeed();
    return HttpResponse.json(existing);
  }),

  http.put(path("/compute-allocation-memberships/:id"), async ({ params, request }) => {
    const existing = seed.memberships.find((m) => m.id === params.id);
    if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = updateMembershipPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    Object.assign(existing, parsed.data);
    persistSeed();
    return HttpResponse.json(existing);
  }),

  http.delete(path("/compute-allocation-memberships/:id"), ({ params }) => {
    const idx = seed.memberships.findIndex((m) => m.id === params.id);
    if (idx < 0) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    seed.memberships.splice(idx, 1);
    persistSeed();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(path("/compute-allocation-membership-resource-overrides"), async ({ request }) => {
    const parsed = overridePayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const created: ComputeAllocationMembershipResourceOverride = {
      id: newId("override"),
      compute_allocation_membership_id: body.compute_allocation_membership_id,
      compute_allocation_resource_id: body.compute_allocation_resource_id,
      override_resource_amount: body.override_resource_amount,
      override_resource_time: body.override_resource_time,
    };
    seed.overrides.push(created);
    persistSeed();
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(
    path("/compute-allocation-membership-resource-overrides/:id"),
    async ({ params, request }) => {
      const existing = seed.overrides.find((o) => o.id === params.id);
      if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
      const parsed = overridePatchSchema.safeParse(await request.json());
      if (!parsed.success) {
        return HttpResponse.json(
          { error: "invalid_request", issues: parsed.error.flatten() },
          { status: 400 },
        );
      }
      Object.assign(existing, parsed.data);
      persistSeed();
      return HttpResponse.json(existing);
    },
  ),

  http.delete(path("/compute-allocation-membership-resource-overrides/:id"), ({ params }) => {
    const idx = seed.overrides.findIndex((o) => o.id === params.id);
    if (idx < 0) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    seed.overrides.splice(idx, 1);
    persistSeed();
    return new HttpResponse(null, { status: 204 });
  }),
];
