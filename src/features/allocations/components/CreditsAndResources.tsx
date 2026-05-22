"use client";

import { formatDate, formatRate, formatSU } from "@/lib/format";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CardSkeleton } from "@/shared/ui/Loading";
import { UsageBar } from "@/shared/ui/UsageBar";
import { useQueries } from "@tanstack/react-query";
import * as React from "react";
import { getResourceRatesEffective } from "../api";
import { allocationKeys, useAllocation, useAllocationResources } from "../queries";

export type CreditsAndResourcesProps = {
  allocationId: string;
  // Pre-aggregated used SU per resource id. Populated by the route layer.
  usedByResource: Map<string, number>;
};

export function CreditsAndResources({ allocationId, usedByResource }: CreditsAndResourcesProps) {
  const allocationQuery = useAllocation(allocationId);
  const resourcesQuery = useAllocationResources(allocationId);

  const resources = React.useMemo(() => resourcesQuery.data ?? [], [resourcesQuery.data]);

  const rateQueries = useQueries({
    queries: resources.map((r) => ({
      queryKey: allocationKeys.resourceRate(r.id),
      queryFn: () => getResourceRatesEffective(r.id),
      enabled: Boolean(r.id),
      retry: false,
    })),
  });

  if (allocationQuery.isLoading || resourcesQuery.isLoading) return <CardSkeleton />;
  if (resourcesQuery.error) {
    return (
      <ErrorState
        message={(resourcesQuery.error as Error).message}
        onRetry={() => resourcesQuery.refetch()}
      />
    );
  }

  const allocation = allocationQuery.data;
  const perResourceMax = resources.length
    ? Math.max(1, Math.floor((allocation?.initial_su_amount ?? 0) / resources.length))
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Resources</h2>
        <p className="text-sm text-muted-foreground">
          Per-resource allocation, usage, and effective rate.
        </p>
      </div>

      {resources.length === 0 ? (
        <EmptyState
          heading="No resources attached"
          description="This allocation has no compute resources yet."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {resources.map((resource, i) => {
            const rate = rateQueries[i]?.data as { rate?: number; start_time?: string } | undefined;
            const used = usedByResource.get(resource.id) ?? 0;
            return (
              <article key={resource.id} className="rounded-md border bg-card p-5">
                <header className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-base font-medium">{resource.name}</h3>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {resource.resource_type} · {formatSU(resource.resource_amount)} units
                    </p>
                  </div>
                  {typeof rate?.rate === "number" ? (
                    <span className="rounded-full bg-[color:var(--nexus-blue-50)] px-2 py-1 text-xs font-medium text-[color:var(--nexus-blue-700)]">
                      {formatRate(rate.rate)} SU/unit
                    </span>
                  ) : null}
                </header>

                <div className="mt-4 space-y-2">
                  <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>Used</span>
                    <span>
                      {formatSU(used)} / {formatSU(perResourceMax)}
                    </span>
                  </div>
                  <UsageBar value={used} max={perResourceMax} size="sm" />
                </div>

                {rate?.start_time ? (
                  <footer className="mt-3 text-xs text-muted-foreground">
                    Rate effective from {formatDate(rate.start_time)}
                  </footer>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
