"use client";

import { ClustersTable } from "@features/admin/components/ClustersTable";
import { useClusters, useUpdateClusterStatus } from "@features/allocations/queries";
import type { Cluster, ClusterStatus } from "@features/allocations/schemas";
import { useAbility } from "@shared/casl/AbilityProvider";
import * as React from "react";

// Container for the Clusters tab on /admin/resources. The CASL `manage
// Cluster` ability gates the EnableToggle — non-admins still see the table +
// current state but the toggle is rendered read-only with a tooltip suffix
// (handled in EnableToggle's `disabled` branch).
export function ClustersContainer() {
  const ability = useAbility();
  const canManage = ability.can("manage", "all") || ability.can("manage", "Cluster");

  const [statusFilter, setStatusFilter] = React.useState<"" | ClusterStatus>("");
  const [typeFilter, setTypeFilter] = React.useState("");
  const [q, setQ] = React.useState("");

  // Always pull the full list so the Status filter can flip between Enabled /
  // Disabled / All without losing rows. Filtering happens client-side in the
  // table — cheap because cluster cardinality is small (single-digit to low
  // dozens even at scale).
  const clustersQuery = useClusters({});
  const updateStatus = useUpdateClusterStatus();

  const rows = clustersQuery.data ?? [];

  async function handleToggle(cluster: Cluster, next: boolean) {
    await updateStatus.mutateAsync({
      id: cluster.id,
      status: next ? "ENABLED" : "DISABLED",
    });
  }

  return (
    <ClustersTable
      rows={rows}
      isLoading={clustersQuery.isLoading}
      error={clustersQuery.error}
      statusFilter={statusFilter}
      typeFilter={typeFilter}
      q={q}
      onStatusChange={setStatusFilter}
      onTypeChange={setTypeFilter}
      onQueryChange={setQ}
      onToggle={handleToggle}
      canManage={canManage}
      onRetry={() => clustersQuery.refetch()}
    />
  );
}
