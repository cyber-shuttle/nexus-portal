import { HttpResponse, http } from "msw";
import { seed } from "../seed";
import { path, paginate } from "./_utils";
import type {
  ChangeRequestStatus,
  ComputeAllocationChangeRequest,
} from "@shared/api/domain";
import {
  createChangeRequestPayloadSchema,
  updateChangeRequestPayloadSchema,
} from "@features/change-requests/api";

function newId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${rand.slice(0, 8)}`;
}

function appendEvent(
  reqId: string,
  eventType: string,
  description: string,
): void {
  seed.changeRequestEvents.push({
    id: newId(`${reqId}-evt`),
    compute_allocation_change_request_id: reqId,
    event_type: eventType,
    description,
    timestamp: new Date().toISOString(),
  });
}

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

  http.post(path("/compute-allocation-change-requests"), async ({ request }) => {
    const parsed = createChangeRequestPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const created: ComputeAllocationChangeRequest = {
      id: newId("cr"),
      compute_allocation_id: body.compute_allocation_id,
      requested_su_amount: body.requested_su_amount,
      requested_status: body.requested_status,
      reason: body.reason,
      change_status: "PENDING",
      requester_id: body.requester_id,
      timestamp: new Date().toISOString(),
    };
    seed.changeRequests.push(created);
    appendEvent(
      created.id,
      "CREATED",
      `Change request created by ${body.requester_id}`,
    );
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(path("/compute-allocation-change-requests/:id"), async ({ params, request }) => {
    const existing = seed.changeRequests.find((c) => c.id === params.id);
    if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = updateChangeRequestPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const patch = parsed.data;
    const prevStatus = existing.change_status;
    Object.assign(existing, patch);
    if (patch.change_status && patch.change_status !== prevStatus) {
      const actor = patch.approver_id ?? "system";
      appendEvent(
        existing.id,
        patch.change_status as ChangeRequestStatus,
        `Change request ${(patch.change_status as string).toLowerCase()} by ${actor}`,
      );
    }
    return HttpResponse.json(existing);
  }),

  http.delete(path("/compute-allocation-change-requests/:id"), ({ params }) => {
    const idx = seed.changeRequests.findIndex((c) => c.id === params.id);
    if (idx < 0) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    seed.changeRequests.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
