"use client";

import { ResourceDetailDrawer } from "@features/admin/components/ResourceDetailDrawer";
import { ResourcesTable } from "@features/admin/components/ResourcesTable";
import { useAdminResources, useAdminResourceTrend } from "@features/admin/queries";
import type { AdminResourceRow } from "@features/admin/schemas";
import { useAbility } from "@shared/casl/AbilityProvider";
import { ErrorState } from "@/shared/ui/ErrorState";
import * as React from "react";

const CLUSTERS = [
  { id: "cluster-001", name: "Nexus-A" },
  { id: "cluster-002", name: "Nexus-B" },
];

export function ResourcesContainer() {
  const ability = useAbility();
  const allowed = ability.can("manage", "all") || ability.can("manage", "Resource");

  const [cluster, setCluster] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [q, setQ] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | undefined>();

  const resourcesQuery = useAdminResources({
    cluster: cluster || undefined,
    status: status || undefined,
    q: q || undefined,
  });
  const trendQuery = useAdminResourceTrend(selectedId);

  const rows = resourcesQuery.data ?? [];
  const selectedRow = rows.find((r) => r.id === selectedId);

  if (!allowed) {
    return (
      <ErrorState
        heading="Not permitted"
        message="Only site admins can manage resources."
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-bold leading-tight">Resources</h1>
        <p className="text-sm text-muted-foreground">
          Site-wide rollup of compute resources across allocations. Click a row to inspect usage
          trends.
        </p>
      </header>

      <ResourcesTable
        rows={rows}
        total={rows.length}
        isLoading={resourcesQuery.isLoading}
        error={resourcesQuery.error}
        clusterFilter={cluster}
        statusFilter={status}
        q={q}
        clusters={CLUSTERS}
        onClusterChange={setCluster}
        onStatusChange={setStatus}
        onQueryChange={setQ}
        onRowClick={(r: AdminResourceRow) => setSelectedId(r.id)}
        onRetry={() => resourcesQuery.refetch()}
      />

      <ResourceDetailDrawer
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined);
        }}
        row={selectedRow}
        trend={trendQuery.data ?? []}
        trendLoading={trendQuery.isLoading}
        error={trendQuery.error}
        onRefresh={() => trendQuery.refetch()}
      />
    </div>
  );
}
