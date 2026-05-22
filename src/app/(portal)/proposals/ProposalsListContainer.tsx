"use client";

import { subject } from "@casl/ability";
import { ProposalsList } from "@features/proposals/components/ProposalsList";
import { useProposals } from "@features/proposals/queries";
import { useAbility } from "@shared/casl/AbilityProvider";
import * as React from "react";

export function ProposalsListContainer() {
  const ability = useAbility();
  const canCreate = ability.can("create", "Proposal");

  const proposalsQuery = useProposals({});
  const allRows = proposalsQuery.data ?? [];
  const rows = React.useMemo(
    () => allRows.filter((p) => ability.can("read", subject("Proposal", p))),
    [allRows, ability],
  );

  return (
    <ProposalsList
      rows={rows}
      isLoading={proposalsQuery.isLoading}
      error={proposalsQuery.error as Error | null}
      canCreate={canCreate}
      onRetry={() => proposalsQuery.refetch()}
    />
  );
}
