import { revokeCertificatePayloadSchema } from "@features/signer/schemas";
import { deriveCertificateStatus } from "@features/signer/types";
import { http, HttpResponse } from "msw";
import { persistSeed, seed } from "../seed";
import { path } from "./_utils";

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function matchTimeRange(issuedAt: number, from: string | null, to: string | null) {
  if (from) {
    const fromSec = Math.floor(new Date(from).getTime() / 1000);
    if (!Number.isNaN(fromSec) && issuedAt < fromSec) return false;
  }
  if (to) {
    const toSec = Math.floor(new Date(`${to}T23:59:59`).getTime() / 1000);
    if (!Number.isNaN(toSec) && issuedAt > toSec) return false;
  }
  return true;
}

export const signerHandlers = [
  http.get(path("/signer/certificates"), ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const username = url.searchParams.get("username");
    const allocationId = url.searchParams.get("allocationId");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.max(0, Number(url.searchParams.get("limit") ?? "0"));
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
    const now = nowSeconds();

    let rows = seed.certificates.slice().sort((a, b) => b.issued_at - a.issued_at);
    if (status && status !== "all") {
      rows = rows.filter((c) => deriveCertificateStatus(c, now) === status);
    }
    if (username) {
      const needle = username.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.username.toLowerCase().includes(needle) || c.principal.toLowerCase().includes(needle),
      );
    }
    if (allocationId) {
      rows = rows.filter((c) => c.allocation_id === allocationId);
    }
    rows = rows.filter((c) => matchTimeRange(c.issued_at, from, to));

    const total = rows.length;
    const window = limit > 0 ? rows.slice(offset, offset + limit) : rows.slice(offset);

    return HttpResponse.json({
      certificates: window,
      total,
      limit,
      offset,
    });
  }),

  http.get(path("/signer/certificates/:serial"), ({ params }) => {
    const serial = Number(params.serial);
    if (Number.isNaN(serial)) {
      return HttpResponse.json({ error: "invalid_serial" }, { status: 400 });
    }
    const row = seed.certificates.find((c) => c.serial_number === serial);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    return HttpResponse.json(row);
  }),

  http.post(path("/signer/certificates/:serial/revoke"), async ({ params, request }) => {
    const serial = Number(params.serial);
    const row = seed.certificates.find((c) => c.serial_number === serial);
    if (!row) return HttpResponse.json({ error: "not_found" }, { status: 404 });
    const parsed = revokeCertificatePayloadSchema.safeParse(await request.json());
    if (!parsed.success) {
      return HttpResponse.json(
        { error: "invalid_request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    if (row.revoked) {
      return HttpResponse.json({ error: "already_revoked" }, { status: 409 });
    }
    row.revoked = true;
    row.revoked_at = nowSeconds();
    row.revocation_reason = parsed.data.reason;
    persistSeed();
    return HttpResponse.json(row);
  }),
];
