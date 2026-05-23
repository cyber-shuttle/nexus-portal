"use client";

import { formatDate, formatRate, formatSU } from "@/lib/format";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CardSkeleton } from "@/shared/ui/Loading";
import {
  MostUsedResourceCallout,
  type MostUsedResourceCalloutRow,
} from "@/shared/ui/MostUsedResourceCallout";
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
  // Default sort: highest Used % first so the most-utilized resource lands at
  // the top of the card grid right next to the callout (TF3 §4).
  const sortedResources = React.useMemo(() => {
    if (resources.length === 0) return resources;
    return resources
      .slice()
      .sort((a, b) => {
        const usedA = usedByResource.get(a.id) ?? 0;
        const usedB = usedByResource.get(b.id) ?? 0;
        return usedB - usedA;
      });
  }, [resources, usedByResource]);
  const calloutRows: MostUsedResourceCalloutRow[] = React.useMemo(() => {
    if (resources.length === 0) return [];
    const totalUsed = resources.reduce(
      (acc, r) => acc + (usedByResource.get(r.id) ?? 0),
      0,
    );
    return resources.map((r) => {
      const used = usedByResource.get(r.id) ?? 0;
      return {
        id: r.id,
        name: r.name,
        used_su: used,
        share_pct: totalUsed > 0 ? (used / totalUsed) * 100 : 0,
      };
    });
  }, [resources, usedByResource]);

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
        <>
          <MostUsedResourceCallout
            resources={calloutRows}
            topN={5}
            onRowClick={(row) => {
              // Drill destination: persona analytics Resources tab with the
              // allocation already selected. Keeps the callout interactive
              // from the allocation detail without baking a per-user drawer
              // here (per spec §6.4 drill-down convention).
              const target = `/analytics?tab=resources&allocation=${allocationId}&resource=${row.id}`;
              if (typeof window !== "undefined") window.location.assign(target);
            }}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sortedResources.map((resource) => {
              // rateQueries are indexed by the original resource order — find
              // the matching slot by id rather than positional index since the
              // grid renders sortedResources.
              const originalIdx = resources.findIndex((r) => r.id === resource.id);
              const rate = rateQueries[originalIdx]?.data as
                | { rate?: number; start_time?: string }
                | undefined;
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
                      <span className="rounded-full bg-brand-tint px-2 py-1 text-xs font-medium text-brand">
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
        </>
      )}
    </div>
  );
}
