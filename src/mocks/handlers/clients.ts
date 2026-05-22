import { HttpResponse, http } from "msw";
import { seed } from "../seed";
import { path } from "./_utils";
import {
  createClientPayloadSchema,
  deactivateClientPayloadSchema,
  rotateClientSecretPayloadSchema,
} from "@features/clients/schemas";

function newId(): string {
  const max = seed.clients.reduce((acc, c) => {
    const match = c.id.match(/client-(\d+)/);
    if (!match || !match[1]) return acc;
    return Math.max(acc, Number.parseInt(match[1], 10));
  }, 0);
  return `client-${String(max + 1).padStart(3, "0")}`;
}

function newClientId(allocationId: string): string {
  return `nexus-${allocationId}-${seed.clients.length + 1}`;
}

function newSecretLast4(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export const clientHandlers = [
  http.get(path("/clients"), ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const allocationId = url.searchParams.get("allocationId");
    const ownerUserId = url.searchParams.get("ownerUserId");
    const limit = Math.max(0, Number(url.searchParams.get("limit") ?? "0"));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));

    let rows = seed.clients
      .slice()
      .sort((a, b) => b.issued_at.localeCompare(a.issued_at));
    if (status && status !== "all") {
      rows = rows.filter((c) => c.status === status);
    }
    if (allocationId) rows = rows.filter((c) => c.allocation_id === allocationId);
    if (ownerUserId) rows = rows.filter((c) => c.owner_user_id === ownerUserId);

    const total = rows.length;
    const window = limit > 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);
    return HttpResponse.json({ clients: window, total, limit, offset });
  }),

  http.get(path("/clients/:id"), ({ params }) => {
    const row = seed.clients.find((c) => c.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(row);
  }),

  http.post(path("/clients"), async ({ request }) => {
    const parsed = createClientPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const allocation = seed.allocations.find((a) => a.id === parsed.data.allocation_id);
    if (!allocation) {
      return HttpResponse.json({ error: "unknown_allocation" }, { status: 422 });
    }
    const now = new Date().toISOString();
    const created = {
      id: newId(),
      name: parsed.data.name,
      allocation_id: parsed.data.allocation_id,
      allocation_name: allocation.name,
      owner_user_id: parsed.data.owner_user_id,
      client_id: newClientId(parsed.data.allocation_id),
      client_secret_last4: newSecretLast4(),
      issued_at: now,
      last_rotated_at: undefined,
      status: "active" as const,
    };
    seed.clients.unshift(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(path("/clients/:id/rotate-secret"), async ({ params, request }) => {
    const row = seed.clients.find((c) => c.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = rotateClientSecretPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (row.status === "deactivated") {
      return HttpResponse.json({ error: "client_deactivated" }, { status: 409 });
    }
    row.client_secret_last4 = newSecretLast4();
    row.last_rotated_at = new Date().toISOString();
    return HttpResponse.json(row);
  }),

  http.post(path("/clients/:id/deactivate"), async ({ params, request }) => {
    const row = seed.clients.find((c) => c.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = deactivateClientPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    row.status = "deactivated";
    return HttpResponse.json(row);
  }),
];
