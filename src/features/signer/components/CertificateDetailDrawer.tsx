"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { StatusBadge, type StatusBadgeVariant } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import type * as React from "react";
import {
  type Certificate,
  type CertificateStatus,
  deriveCertificateStatus,
  formatLifetime,
  formatRemainingTime,
  formatUnixDateTime,
  getCertificateAllocationLabel,
  getRemainingSeconds,
} from "../types";
import { RevokeDialog } from "./RevokeDialog";

function statusVariant(status: CertificateStatus): StatusBadgeVariant {
  if (status === "active") return "active";
  if (status === "revoked") return "rejected";
  return "expired";
}

export type CertificateDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cert: Certificate | undefined;
  isLoading: boolean;
  error: Error | null;
  canRevoke: boolean;
  onRetry?: () => void;
};

export function CertificateDetailDrawer({
  open,
  onOpenChange,
  cert,
  isLoading,
  error,
  canRevoke,
  onRetry,
}: CertificateDetailDrawerProps) {
  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={cert ? `Certificate ${cert.serial_number}` : "Certificate"}
      description={cert ? `Issued to ${cert.username || cert.principal}` : undefined}
    >
      {isLoading ? (
        <CenteredSpinner label="Loading certificate" />
      ) : error ? (
        <ErrorState message={error.message ?? "Failed to load certificate"} onRetry={onRetry} />
      ) : !cert ? (
        <p className="text-sm text-muted-foreground">Certificate not found.</p>
      ) : (
        <CertificateDetailBody cert={cert} canRevoke={canRevoke} />
      )}
    </SideDrawer>
  );
}

function CertificateDetailBody({ cert, canRevoke }: { cert: Certificate; canRevoke: boolean }) {
  const status = deriveCertificateStatus(cert);
  const isActive = status === "active";

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="mt-1 flex items-center gap-3">
            <StatusBadge variant={statusVariant(status)} label={status.toUpperCase()} />
            {isActive && (
              <span className="text-sm tabular-nums text-muted-foreground">
                {formatRemainingTime(getRemainingSeconds(cert))} remaining
              </span>
            )}
          </div>
        </div>
        {canRevoke && isActive && (
          <RevokeDialog trigger={<Button variant="destructive">Revoke</Button>} cert={cert} />
        )}
      </div>

      <Section title="Main info">
        <Detail label="Serial number" value={String(cert.serial_number)} />
        <Detail label="Username" value={cert.username || cert.principal} />
        <Detail label="Key ID" value={cert.key_id} mono />
        <Detail label="Allocation" value={getCertificateAllocationLabel(cert)} />
        <Detail label="Public key fingerprint" value={cert.public_key_fingerprint} mono />
        <Detail label="CA fingerprint" value={cert.ca_fingerprint} mono />
        <Detail label="Forced command" value={cert.force_command || "—"} />
        <Detail label="Source IP" value={cert.source_ip || "—"} />
      </Section>

      <Section title="Validity">
        <Detail label="Issued at" value={formatUnixDateTime(cert.issued_at)} />
        <Detail label="Valid from" value={formatUnixDateTime(cert.valid_after)} />
        <Detail label="Valid until" value={formatUnixDateTime(cert.valid_before)} />
        <Detail label="Lifetime" value={formatLifetime(cert)} />
      </Section>

      {cert.granted_extensions.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Granted extensions
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {cert.granted_extensions.map((ext) => (
              <li key={ext}>{ext}</li>
            ))}
          </ul>
        </section>
      )}

      {status === "revoked" && (
        <Section title="Revocation">
          <Detail
            label="Revoked at"
            value={cert.revoked_at ? formatUnixDateTime(cert.revoked_at) : "—"}
          />
          <Detail label="Reason" value={cert.revocation_reason || "—"} />
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-heading text-base font-semibold text-foreground">{title}</h2>
      <dl className="space-y-2">{children}</dl>
    </section>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] items-start gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "break-all font-mono text-xs" : "break-words"}>{value}</dd>
    </div>
  );
}
