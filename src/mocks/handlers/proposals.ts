import { HttpResponse, http } from "msw";
import { z } from "zod";
import { persistSeed, seed } from "../seed";
import { path, paginate } from "./_utils";
import type { Proposal } from "@features/proposals/types";
import {
  createProposalPayloadSchema,
  proposalDecisionPayloadSchema,
  updateProposalPayloadSchema,
} from "@features/proposals/schemas";

function newId(): string {
  const rand = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `prop-${rand.slice(0, 8)}`;
}

function matchStatus(proposal: Proposal, statusParam: string | null): boolean {
  if (!statusParam) return true;
  const wanted = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
  return wanted.length === 0 || wanted.includes(proposal.status);
}

const withdrawPayloadSchema = z.object({ requester_id: z.string().min(1) });

export const proposalHandlers = [
  http.get(path("/proposals"), ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const projectId = url.searchParams.get("project_id");
    const requesterId = url.searchParams.get("requester_id");
    const q = url.searchParams.get("q");
    let rows = seed.proposals.slice().sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    rows = rows.filter((p) => matchStatus(p, status));
    if (projectId) rows = rows.filter((p) => p.project_id === projectId);
    if (requesterId) rows = rows.filter((p) => p.requester_id === requesterId);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.title.toLowerCase().includes(needle) ||
          p.project_title.toLowerCase().includes(needle),
      );
    }
    return HttpResponse.json(paginate(rows, url));
  }),

  http.get(path("/proposals/:id"), ({ params }) => {
    const row = seed.proposals.find((p) => p.id === params.id);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(row);
  }),

  http.post(path("/proposals"), async ({ request }) => {
    const parsed = createProposalPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    const created: Proposal = {
      id: newId(),
      ...parsed.data,
      created_at: now,
      updated_at: now,
    };
    seed.proposals.unshift(created);
    persistSeed();
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(path("/proposals/:id"), async ({ params, request }) => {
    const existing = seed.proposals.find((p) => p.id === params.id);
    if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = updateProposalPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    Object.assign(existing, parsed.data, { updated_at: new Date().toISOString() });
    persistSeed();
    return HttpResponse.json(existing);
  }),

  http.post(path("/proposals/:id/approve"), async ({ params, request }) => {
    const existing = seed.proposals.find((p) => p.id === params.id);
    if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = proposalDecisionPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    existing.status = "APPROVED";
    existing.decision = {
      decided_by: parsed.data.decided_by,
      decided_at: now,
      decision_note: parsed.data.decision_note,
    };
    existing.updated_at = now;
    persistSeed();
    return HttpResponse.json(existing);
  }),

  http.post(path("/proposals/:id/deny"), async ({ params, request }) => {
    const existing = seed.proposals.find((p) => p.id === params.id);
    if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = proposalDecisionPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const now = new Date().toISOString();
    existing.status = "DENIED";
    existing.decision = {
      decided_by: parsed.data.decided_by,
      decided_at: now,
      decision_note: parsed.data.decision_note,
    };
    existing.updated_at = now;
    persistSeed();
    return HttpResponse.json(existing);
  }),

  http.post(path("/proposals/:id/withdraw"), async ({ params, request }) => {
    const existing = seed.proposals.find((p) => p.id === params.id);
    if (!existing) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = withdrawPayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (existing.requester_id !== parsed.data.requester_id) {
      return HttpResponse.json({ error: "forbidden" }, { status: 403 });
    }
    existing.status = "WITHDRAWN";
    existing.updated_at = new Date().toISOString();
    persistSeed();
    return HttpResponse.json(existing);
  }),
];
