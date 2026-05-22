"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
      error={query.error as Error | null}
      canRevoke={ability.can("revoke", "Certificate")}
      onRetry={() => query.refetch()}
    />
  );
}
