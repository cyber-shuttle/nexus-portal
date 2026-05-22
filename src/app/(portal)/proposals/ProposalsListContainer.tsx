"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { useAbility } from "@shared/casl/AbilityProvider";
import { ProposalsList } from "@features/proposals/components/ProposalsList";
import { useProposals } from "@features/proposals/queries";

export function ProposalsListContainer() {
  const { data: session } = useSession();
  const ability = useAbility();
  const role = session?.user?.role;
  const userId = session?.user?.id ?? "";

  const isAdmin = role === "admin";
  const isPi = role === "pi" || role === "co_pi";
  const canCreate = ability.can("create", "Proposal");

  const ownProposals = useProposals(isPi || (!isAdmin && userId) ? { requester_id: userId } : {});
  const allProposals = useProposals(isAdmin ? {} : { requester_id: "__none__" });

  // Researchers (role=user) shouldn't see proposals at all per spec; render an empty
  // list deliberately, not a query.
  const showOwn = isPi;
  const showAll = isAdmin;

  const rows = showAll
    ? (allProposals.data ?? [])
    : showOwn
      ? (ownProposals.data ?? [])
      : [];

  const isLoading = showAll
    ? allProposals.isLoading
    : showOwn
      ? ownProposals.isLoading
      : false;

  const error = (showAll
    ? (allProposals.error as Error | null)
    : showOwn
      ? (ownProposals.error as Error | null)
      : null);

  function onRetry() {
    if (showAll) allProposals.refetch();
    if (showOwn) ownProposals.refetch();
  }

  return (
    <ProposalsList
      rows={rows}
      isLoading={isLoading}
      error={error}
      canCreate={canCreate}
      onRetry={onRetry}
    />
  );
}
