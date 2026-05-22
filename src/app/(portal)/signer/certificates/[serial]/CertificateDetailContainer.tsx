"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { subject } from "@casl/ability";
import { useAbility } from "@shared/casl/AbilityProvider";
import { CertificateDetailDrawer } from "@features/signer/components/CertificateDetailDrawer";
import { useCertificate } from "@features/signer/queries";

export function CertificateDetailContainer({ serial }: { serial: string }) {
  const router = useRouter();
  const ability = useAbility();
  const query = useCertificate(serial);

  return (
    <CertificateDetailDrawer
      open
      onOpenChange={(open) => {
        if (!open) router.push("/signer/certificates");
      }}
      cert={query.data}
      isLoading={query.isLoading}
      error={query.error}
      canRevoke={
        query.data
          ? ability.can(
              "revoke",
              subject("Certificate", {
                username: query.data.username,
                allocation_id: query.data.allocation_id,
              }),
            )
          : false
      }
      onRetry={() => query.refetch()}
    />
  );
}
