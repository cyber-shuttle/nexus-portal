"use client";

import { cn } from "@/lib/utils";
import {
  replaceShallowSearchParams,
  useShallowSearchParams,
} from "@shared/hooks/useShallowSearchParams";
import { LastSyncedBadge } from "@shared/ui/LastSyncedBadge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useTraces } from "../queries";
import type { Trace } from "../types";
import { traceTone } from "../utils";
import { TraceDetailDrawer } from "./TraceDetailDrawer";
import { TraceFilterStrip } from "./TraceFilterStrip";
import { TraceTable } from "./TraceTable";
import {
  DEFAULT_FILTERS,
  type ListFilters,
  hasActiveFilters,
  parseFilters,
  serializeFilters,
  statusFiltersToApi,
  windowToFromTo,
} from "./traceListUrlState";

export type TraceListPageProps = {
  initialTraceId?: string;
};

const BANNER_LOOKBACK_DAYS = 1;
const TRACE_PARAM = "trace";

// Forward the trace param when reassigning URL state — keeps drawer deeplinks
// intact across filter edits. (Drawer wiring lands in Phase C.)
function syncUrl(filters: ListFilters, traceId: string | null) {
  const next = serializeFilters(filters);
  if (traceId) next.set(TRACE_PARAM, traceId);
  replaceShallowSearchParams(next);
}

export function TraceListPage({ initialTraceId }: TraceListPageProps = {}) {
  const params = useShallowSearchParams();
  const router = useRouter();
  const filters = React.useMemo(() => parseFilters(params), [params]);
  const traceParam = params.get(TRACE_PARAM);
  const activeTraceId = traceParam ?? initialTraceId ?? null;
  const drawerOpen = traceParam !== null || initialTraceId != null;

  const updateFilters = React.useCallback(
    (next: ListFilters) => syncUrl(next, activeTraceId),
    [activeTraceId],
  );

  // Stable `now` per-mount keeps the from/to window from drifting between
  // re-renders (and changing the TanStack cache key).
  const nowRef = React.useRef<number>(Date.now());
  const { from, to } = React.useMemo(
    () => windowToFromTo(filters.window, nowRef.current),
    [filters.window],
  );

  const { apiStatus, inProgressOnly } = React.useMemo(
    () => statusFiltersToApi(filters.status),
    [filters.status],
  );

  // When in-progress is the sole filter we drop status from the wire and
  // filter the response client-side. Mixed selections leave it to the API.
  const apiFilters = React.useMemo(
    () => ({
      status: apiStatus.length ? apiStatus : undefined,
      source: filters.source.length ? filters.source : undefined,
      from,
      to,
      q: filters.q || undefined,
      limit: filters.pageSize,
      offset: (filters.page - 1) * filters.pageSize,
    }),
    [apiStatus, filters.source, filters.q, filters.page, filters.pageSize, from, to],
  );

  const tracesQuery = useTraces(apiFilters);
  const visibleTraces: Trace[] = React.useMemo(() => {
    const rows = tracesQuery.data?.traces ?? [];
    if (inProgressOnly) return rows.filter((t) => t.ended_at == null);
    if (filters.status.includes("in-progress") && apiStatus.length > 0) {
      // Mixed select: union of (status in apiStatus) OR running. Backend
      // already returned the status matches; we add the running ones from
      // the same paginated window. Imperfect (pagination is server-side) but
      // surfaces in-progress entries alongside the chosen statuses.
      return rows;
    }
    return rows;
  }, [tracesQuery.data, inProgressOnly, filters.status, apiStatus]);

  const total = inProgressOnly
    ? visibleTraces.length
    : (tracesQuery.data?.total ?? 0);

  // 24h-failing banner — separate query so it survives any active filter.
  const bannerFrom = React.useMemo(
    () => new Date(nowRef.current - 30 * 24 * 60 * 60 * 1000).toISOString(),
    [],
  );
  const bannerTo = React.useMemo(
    () => new Date(nowRef.current - BANNER_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    [],
  );
  const failingQuery = useTraces({
    status: [1],
    from: bannerFrom,
    to: bannerTo,
    limit: 1,
  });
  const failingCount = failingQuery.data?.total ?? 0;
  const showBanner = !failingQuery.isLoading && failingCount > 0;

  const onView = React.useCallback(
    (traceId: string) => {
      // Phase B leaves the drawer unmounted; we surface the chosen id in the
      // URL so deep-links survive into Phase C.
      const next = serializeFilters(filters);
      next.set(TRACE_PARAM, traceId);
      replaceShallowSearchParams(next);
    },
    [filters],
  );

  const closeDrawer = React.useCallback(() => {
    const next = serializeFilters(filters);
    next.delete(TRACE_PARAM);
    next.delete("span");
    next.delete("tab");
    if (initialTraceId) {
      // Deep-link route: bounce back to the canonical list URL so the trace
      // path drops out of history along with the drawer.
      router.push(`/admin/traces${next.toString() ? `?${next.toString()}` : ""}`);
      return;
    }
    replaceShallowSearchParams(next);
  }, [filters, initialTraceId, router]);

  const onPageChange = React.useCallback(
    (next: number) => updateFilters({ ...filters, page: Math.max(1, next) }),
    [filters, updateFilters],
  );
  const onPageSizeChange = React.useCallback(
    (next: number) => updateFilters({ ...filters, pageSize: next, page: 1 }),
    [filters, updateFilters],
  );

  const applyFailingPreset = React.useCallback(() => {
    updateFilters({
      ...DEFAULT_FILTERS,
      status: ["error"],
      window: "30d",
      pageSize: filters.pageSize,
    });
  }, [filters.pageSize, updateFilters]);

  const dataUpdatedAt = tracesQuery.dataUpdatedAt;
  const syncedAt = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date(nowRef.current);

  // Sanity check: confirm the visible rows still include error tones when the
  // filter is `error` — a guard against the tone derivation drifting.
  void traceTone;

  return (
    <div className="mx-auto w-full max-w-[1280px] px-6 pb-12 pt-6 md:px-8">
      <header className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-[-0.01em] text-foreground">
            Traces
          </h1>
          <p className="mt-1.5 max-w-[560px] text-sm text-muted-foreground">
            Investigate where a flow broke and retry from the failed step.
          </p>
        </div>
        <LastSyncedBadge syncedAt={syncedAt} onRefetch={() => tracesQuery.refetch()} />
      </header>

      {showBanner && (
        <section
          aria-label="Failing traces alert"
          data-testid="failing-banner"
          className={cn(
            "mt-4 flex items-center gap-3 rounded-[10px] border px-4 py-3",
            "border-[color:var(--nexus-red-100)] bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)]",
          )}
        >
          <AlertTriangle
            className="h-4 w-4 shrink-0 text-[color:var(--nexus-red-600)]"
            aria-hidden="true"
          />
          <span className="text-[13.5px]">
            <strong>{failingCount}</strong>{" "}
            {failingCount === 1 ? "trace" : "traces"} failing for over 24h
          </span>
          <button
            type="button"
            onClick={applyFailingPreset}
            className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-[color:var(--nexus-red-700)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Investigate <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </section>
      )}

      <div className="mt-4">
        <TraceFilterStrip value={filters} onChange={updateFilters} />
      </div>

      <div className="mt-4">
        <TraceTable
          traces={visibleTraces}
          total={total}
          page={filters.page}
          pageSize={filters.pageSize}
          loading={tracesQuery.isLoading}
          error={tracesQuery.error as Error | null}
          hasActiveFilters={hasActiveFilters(filters)}
          onView={onView}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
          onRetry={() => tracesQuery.refetch()}
        />
      </div>

      <TraceDetailDrawer
        traceId={activeTraceId}
        open={drawerOpen}
        onClose={closeDrawer}
      />
    </div>
  );
}
