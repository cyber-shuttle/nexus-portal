"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useAbility } from "@shared/casl/AbilityProvider";
import { CertificateList } from "@features/signer/components/CertificateList";
import { CertificateDetailDrawer } from "@features/signer/components/CertificateDetailDrawer";
import {
  useCertificate,
  useCertificates,
} from "@features/signer/queries";
import type { CertificateStatus } from "@features/signer/types";

const TIME_RANGES: Record<string, number> = {
  "All time": 0,
  "Last 24 hours": 24 * 3600,
  "Last 7 days": 7 * 24 * 3600,
  "Last 30 days": 30 * 24 * 3600,
};

export function CertificatesContainer() {
  const { data: session } = useSession();
  const ability = useAbility();
  const isAdmin = session?.user?.role === "admin";
  const userEmail = session?.user?.email ?? "";

  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(10);
  const [statusFilter, setStatusFilter] = React.useState<CertificateStatus | "all">("all");
  const [usernameFilter, setUsernameFilter] = React.useState(isAdmin ? "" : userEmail);
  const [allocationFilter, setAllocationFilter] = React.useState("all");
  const [timeRangeLabel, setTimeRangeLabel] = React.useState("All time");
  const [selectedSerial, setSelectedSerial] = React.useState<number | undefined>(undefined);

  // Non-admin users can only see their own certs. Pin the username filter to
  // their email and keep the UI from accidentally clearing it.
  React.useEffect(() => {
    if (!isAdmin && userEmail) setUsernameFilter(userEmail);
  }, [isAdmin, userEmail]);

  const fromIso = React.useMemo(() => {
    const seconds = TIME_RANGES[timeRangeLabel] ?? 0;
    if (!seconds) return undefined;
    return new Date(Date.now() - seconds * 1000).toISOString();
  }, [timeRangeLabel]);

  const certificatesQuery = useCertificates({
    status: statusFilter,
    username: usernameFilter || undefined,
    allocationId: allocationFilter !== "all" ? allocationFilter : undefined,
    from: fromIso,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const selectedQuery = useCertificate(selectedSerial);

  const certificates = certificatesQuery.data?.certificates ?? [];
  const total = certificatesQuery.data?.total ?? 0;

  return (
    <>
      <CertificateList
        rows={certificates}
        total={total}
        isLoading={certificatesQuery.isLoading}
        error={certificatesQuery.error as Error | null}
        page={page}
        pageSize={pageSize}
        statusFilter={statusFilter}
        usernameFilter={usernameFilter}
        allocationFilter={allocationFilter}
        timeRangeLabel={timeRangeLabel}
        onPageChange={setPage}
        onStatusChange={(s) => {
          setStatusFilter(s);
          setPage(1);
        }}
        onUsernameChange={(u) => {
          setUsernameFilter(u);
          setPage(1);
        }}
        onAllocationChange={(a) => {
          setAllocationFilter(a);
          setPage(1);
        }}
        onTimeRangeChange={(label) => {
          setTimeRangeLabel(label);
          setPage(1);
        }}
        onRowClick={(cert) => setSelectedSerial(cert.serial_number)}
        onRetry={() => certificatesQuery.refetch()}
      />

      <CertificateDetailDrawer
        open={selectedSerial != null}
        onOpenChange={(open) => {
          if (!open) setSelectedSerial(undefined);
        }}
        cert={selectedQuery.data}
        isLoading={selectedQuery.isLoading}
        error={selectedQuery.error as Error | null}
        canRevoke={ability.can("revoke", "Certificate")}
        onRetry={() => selectedQuery.refetch()}
      />
    </>
  );
}
