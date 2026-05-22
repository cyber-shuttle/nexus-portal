import { creditTransferPayloadSchema } from "@features/tools/schemas";
import { http, HttpResponse } from "msw";
import { persistSeed, seed } from "../seed";
import { path } from "./_utils";

function newId(prefix: string): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${rand.slice(0, 8)}`;
}

function balanceFor(allocationId: string): number {
  const alloc = seed.allocations.find((a) => a.id === allocationId);
  if (!alloc) return 0;
  const used = seed.usages
    .filter((u) => u.compute_allocation_id === allocationId)
    .reduce((acc, u) => acc + u.used_su_amount, 0);
  return alloc.initial_su_amount - used;
}

export const toolsHandlers = [
  http.post(path("/tools/credit-transfer"), async ({ request }) => {
    const parsed = creditTransferPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    if (body.source_allocation_id === body.destination_allocation_id) {
      return HttpResponse.json({ error: "source_and_destination_must_differ" }, { status: 400 });
    }
    const source = seed.allocations.find((a) => a.id === body.source_allocation_id);
    const destination = seed.allocations.find((a) => a.id === body.destination_allocation_id);
    if (!source || !destination) {
      return HttpResponse.json({ error: "allocation_not_found" }, { status: 404 });
    }
    if (source.status !== "ACTIVE" || destination.status !== "ACTIVE") {
      return HttpResponse.json({ error: "allocations_must_be_active" }, { status: 409 });
    }
    const remaining = balanceFor(source.id);
    if (body.su_amount > remaining) {
      return HttpResponse.json(
        {
          error: "insufficient_balance",
          available: remaining,
          requested: body.su_amount,
        },
        { status: 409 },
      );
    }
    const now = new Date().toISOString();
    const sourceBefore = source.initial_su_amount;
    const destBefore = destination.initial_su_amount;
    source.initial_su_amount -= body.su_amount;
    destination.initial_su_amount += body.su_amount;
    const transferId = newId("xfer");
    // Paired diff rows: same transfer_id links the OUT and IN. Audit log queries
    // can rejoin a transfer by transfer_id without scanning descriptions.
    seed.diffs.push({
      id: `${source.id}-diff-${transferId}-out`,
      compute_allocation_id: source.id,
      diff_type: "CREDIT_TRANSFER_OUT",
      new_su_amount: source.initial_su_amount,
      status: source.status,
      timestamp: now,
      description: `Transferred ${body.su_amount.toLocaleString()} SU to ${destination.id} by ${body.transferred_by}${body.note ? ` — ${body.note}` : ""}`,
      field: "initial_su_amount",
      old_value: sourceBefore,
      new_value: source.initial_su_amount,
      transfer_id: transferId,
    });
    seed.diffs.push({
      id: `${destination.id}-diff-${transferId}-in`,
      compute_allocation_id: destination.id,
      diff_type: "CREDIT_TRANSFER_IN",
      new_su_amount: destination.initial_su_amount,
      status: destination.status,
      timestamp: now,
      description: `Received ${body.su_amount.toLocaleString()} SU from ${source.id} by ${body.transferred_by}${body.note ? ` — ${body.note}` : ""}`,
      field: "initial_su_amount",
      old_value: destBefore,
      new_value: destination.initial_su_amount,
      transfer_id: transferId,
    });
    persistSeed();
    return HttpResponse.json(
      {
        transfer_id: transferId,
        source_allocation_id: source.id,
        destination_allocation_id: destination.id,
        compute_allocation_resource_id: body.compute_allocation_resource_id,
        su_amount: body.su_amount,
        transferred_by: body.transferred_by,
        transferred_at: now,
        source_balance_after: balanceFor(source.id),
        destination_balance_after: balanceFor(destination.id),
      },
      { status: 201 },
    );
  }),
];
