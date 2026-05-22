export const CERTIFICATE_STATUSES = ["active", "expired", "revoked"] as const;

export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

export type Certificate = {
  serial_number: number;
  client_id?: string;
  allocation_id?: string;
  allocation_name?: string;
  key_id: string;
  principal: string;
  username: string;
  public_key_fingerprint: string;
  ca_fingerprint: string;
  valid_after: number;
  valid_before: number;
  issued_at: number;
  source_ip?: string;
  granted_extensions: string[];
  force_command?: string | null;
  revoked: boolean;
  revoked_at?: number;
  revocation_reason?: string;
};

export type CertificateListResponse = {
  certificates: Certificate[];
  total: number;
  limit: number;
  offset: number;
};

export type CertificateListParams = {
  status?: CertificateStatus | "all";
  username?: string;
  allocationId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export function deriveCertificateStatus(cert: Certificate, nowSeconds?: number): CertificateStatus {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  if (cert.revoked) return "revoked";
  if (cert.valid_before < now) return "expired";
  return "active";
}

export function getCertificateAllocationLabel(cert: Certificate): string {
  return cert.allocation_name ?? cert.allocation_id ?? cert.client_id ?? "Unassigned";
}

export function getRemainingSeconds(cert: Certificate, nowSeconds?: number): number {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000);
  return Math.max(0, cert.valid_before - now);
}

export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

export function formatLifetime(cert: Certificate): string {
  const seconds = Math.max(0, cert.valid_before - cert.valid_after);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes === 0) return `${hours} hour${hours === 1 ? "" : "s"}`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  return `${seconds}s`;
}

export function formatUnixDateTime(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString();
}

export function formatUnixDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString();
}

export function formatUnixClock(seconds: number): string {
  return new Date(seconds * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
