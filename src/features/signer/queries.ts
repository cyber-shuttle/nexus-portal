"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCertificate, listCertificates, revokeCertificate } from "./api";
import type { CertificateListParams } from "./types";
import type { RevokeCertificatePayload } from "./schemas";

export const signerKeys = {
  all: ["signer"] as const,
  certificates: () => [...signerKeys.all, "certificates"] as const,
  list: (params: CertificateListParams) =>
    [...signerKeys.certificates(), "list", params] as const,
  detail: (serial: number | string) =>
    [...signerKeys.certificates(), "detail", String(serial)] as const,
};

export function useCertificates(params: CertificateListParams = {}) {
  return useQuery({
    queryKey: signerKeys.list(params),
    queryFn: () => listCertificates(params),
  });
}

export function useCertificate(serial: number | string | undefined) {
  return useQuery({
    queryKey: serial != null ? signerKeys.detail(serial) : signerKeys.detail("none"),
    queryFn: () => getCertificate(serial as number | string),
    enabled: serial != null && serial !== "",
  });
}

export function useRevokeCertificate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      serial,
      payload,
    }: {
      serial: number | string;
      payload: RevokeCertificatePayload;
    }) => revokeCertificate(serial, payload),
    onSuccess: (cert) => {
      client.invalidateQueries({ queryKey: signerKeys.certificates() });
      client.setQueryData(signerKeys.detail(cert.serial_number), cert);
    },
  });
}
