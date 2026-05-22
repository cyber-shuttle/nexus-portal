"use client";

import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import {
  useAllocation,
  useAllocationResources,
  allocationKeys,
} from "../queries";
import { getResourceRatesEffective } from "../api";
import { UsageBar } from "@/shared/ui/UsageBar";
import { Button } from "@/shared/ui/button";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { CardSkeleton } from "@/shared/ui/Loading";
import { ErrorState } from "@/shared/ui/ErrorState";
import { EmptyState } from "@/shared/ui/EmptyState";
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatSU(n: number): string {
  return new Intl.NumberFormat().format(n);
}

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

  const [drawerOpen, setDrawerOpen] = React.useState(false);

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-xl font-semibold">Resources</h2>
          <p className="text-sm text-muted-foreground">
            Per-resource allocation, usage, and effective rate.
          </p>
        </div>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                aria-label="Request extension"
                onClick={() => setDrawerOpen(true)}
              >
                Request extension
              </Button>
            }
          />
          <TooltipContent>Opens the change-request drawer (Phase 3)</TooltipContent>
        </Tooltip>
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
                      {rate.rate} SU/unit
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

      <SideDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Request extension"
        description="Submit a change request to extend SUs or end date"
      >
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Available in Phase 3 — change-request workflow.
          </p>
          <p className="text-sm text-muted-foreground">
            You'll be able to request additional SUs or extend the end date here, and an
            allocation manager will approve or reject the request.
          </p>
        </div>
      </SideDrawer>
    </div>
  );
}
