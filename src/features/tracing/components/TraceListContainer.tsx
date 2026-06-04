"use client";

import {
  replaceShallowSearchParams,
  useShallowSearchParams,
} from "@/shared/hooks/useShallowSearchParams";
import { LastSyncedBadge } from "@/shared/ui/LastSyncedBadge";
import { Button } from "@/shared/ui/button";
import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTraces } from "../queries";
import { TraceDetailDrawer } from "./TraceDetailDrawer";
import { DEFAULT_FILTERS, TraceFilterStrip } from "./TraceFilterStrip";
import { TraceTable } from "./TraceTable";
import { TraceTrendChart } from "./TraceTrendChart";
import {
  computeWindow,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
} from "./traceListUrlState";

const DAY_MS = 24 * 60 * 60 * 1000;

export function TraceListContainer({ initialTraceId }: { initialTraceId?: string } = {}) {
  const router = useRouter();
  const searchParams = useShallowSearchParams();

  const filters = React.useMemo(() => parseFilters(searchParams), [searchParams]);

  // Snap windows to a stable "now" so re-renders don't reshape the cache key
  // and force the list/stats queries into a refetch loop.
  const nowRef = React.useRef<number>(Date.now());
  const windowBounds = React.useMemo(() => computeWindow(filters, nowRef.current), [filters]);
  const listQuery = useTraces({
    status: filters.status.length ? filters.status : undefined,
    source: filters.source.length ? filters.source : undefined,
    from: windowBounds.from,
    to: windowBounds.to,
    q: filters.q || undefined,
    limit: filters.limit,
    offset: filters.offset,
  });

  // Drawer state. initialTraceId comes from the deep-link route
  // (/admin/traces/{id}); ?trace=<id> is set by row clicks so the list never
  // re-mounts. Both feed the same `selectedTraceId`.
  const traceParam = searchParams.get("trace");
  const selectedTraceId = initialTraceId ?? traceParam ?? null;

  // Sticky banner needs a count of failing traces in the last 24h. When the
  // active filters already cover that exact case, we can reuse listQuery's
  // total instead of firing an overlapping side query.
  const failingSince = React.useMemo(() => new Date(nowRef.current - DAY_MS).toISOString(), []);
  const listCoversFailing =
    filters.status.length === 1 &&
    filters.status[0] === 1 &&
    !!windowBounds.from &&
    windowBounds.from <= failingSince;
  const failingQuery = useTraces(
    { status: [1], from: failingSince, limit: 1 },
    { enabled: !listCoversFailing },
  );
  const failingCount = listCoversFailing
    ? (listQuery.data?.total ?? 0)
    : (failingQuery.data?.total ?? 0);

  const updateFilters = React.useCallback(
    (next: typeof filters) => {
      const params = serializeFilters(next);
      // Preserve the drawer's `trace` param so changing filters never closes
      // the open drawer.
      if (traceParam) params.set("trace", traceParam);
      replaceShallowSearchParams(params);
    },
    [traceParam],
  );

  const investigateFailing = React.useCallback(() => {
    updateFilters({
      ...DEFAULT_FILTERS,
      status: [1],
      preset: "custom",
      from: failingSince,
    });
  }, [updateFilters, failingSince]);

  const openDrawer = React.useCallback(
    (traceId: string) => {
      // Shallow URL update — Next App Router's router.replace would force an
      // RSC roundtrip on every row click, leaving the drawer animation waiting
      // hundreds of ms. Deep links into /admin/traces/{id} still work via
      // initialTraceId on the deep-link route page.
      const params = new URLSearchParams(searchParams.toString());
      params.set("trace", traceId);
      replaceShallowSearchParams(params);
    },
    [searchParams],
  );

  const closeDrawer = React.useCallback(() => {
    if (initialTraceId) {
      // Deep-link route doesn't surface filters, so closing drops to the bare
      // list route — there's no in-URL filter state to preserve.
      router.push("/admin/traces", { scroll: false });
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("trace");
    // Drop drawer-scoped params so reopening a different trace starts clean.
    params.delete("span");
    params.delete("tab");
    replaceShallowSearchParams(params);
  }, [initialTraceId, router, searchParams]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-[28px] font-bold leading-tight">Tracing</h1>
          <p className="text-sm text-muted-foreground">
            View and replay request flows across Custos.
          </p>
        </div>
        {listQuery.dataUpdatedAt ? (
          <LastSyncedBadge
            syncedAt={new Date(listQuery.dataUpdatedAt)}
            onRefetch={() => listQuery.refetch()}
          />
        ) : null}
      </header>

      {failingCount > 0 ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--nexus-amber-200)] bg-[color:var(--nexus-amber-50)] px-4 py-3 text-sm text-[color:var(--nexus-amber-700)]"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <span>
              {failingCount} {failingCount === 1 ? "trace has" : "traces have"} been failing for
              over 24h.
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={investigateFailing}>
            Investigate →
          </Button>
        </div>
      ) : null}

      <TraceFilterStrip value={filters} onChange={updateFilters} />

      <TraceTrendChart />

      <TraceTable
        traces={listQuery.data?.traces ?? []}
        total={listQuery.data?.total ?? 0}
        limit={filters.limit}
        offset={filters.offset}
        loading={listQuery.isLoading}
        hasFilters={hasActiveFilters(filters)}
        error={listQuery.error}
        onPageChange={(nextOffset) => updateFilters({ ...filters, offset: nextOffset })}
        onView={openDrawer}
        onRetry={() => listQuery.refetch()}
      />

      <TraceDetailDrawer
        traceId={selectedTraceId}
        open={selectedTraceId != null}
        onClose={closeDrawer}
      />
    </div>
  );
}
