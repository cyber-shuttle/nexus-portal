import { apiFetch } from "@shared/api/client";
import type { Certificate, CertificateListParams, CertificateListResponse } from "./types";
import {
  certificateListResponseSchema,
  certificateSchema,
  revokeCertificatePayloadSchema,
  type RevokeCertificatePayload,
} from "./schemas";

function toQuery(params: CertificateListParams): string {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") search.set("status", params.status);
  if (params.username) search.set("username", params.username);
  if (params.allocationId) search.set("allocationId", params.allocationId);
  if (params.from) search.set("from", params.from);
  if (params.to) search.set("to", params.to);
  if (params.limit != null) search.set("limit", String(params.limit));
  if (params.offset != null) search.set("offset", String(params.offset));
  return search.toString();
}

export async function listCertificates(
  params: CertificateListParams = {},
): Promise<CertificateListResponse> {
  const q = toQuery(params);
  const raw = await apiFetch(`/signer/certificates${q ? `?${q}` : ""}`);
  return certificateListResponseSchema.parse(raw);
}

export async function getCertificate(serial: number | string): Promise<Certificate> {
  const raw = await apiFetch(`/signer/certificates/${serial}`);
  return certificateSchema.parse(raw);
}

export async function revokeCertificate(
  serial: number | string,
  payload: RevokeCertificatePayload,
): Promise<Certificate> {
  const parsed = revokeCertificatePayloadSchema.parse(payload);
  const raw = await apiFetch(`/signer/certificates/${serial}/revoke`, {
    method: "POST",
    body: parsed,
  });
  return certificateSchema.parse(raw);
}
