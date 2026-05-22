"use client";

import { formatDate, formatNumber } from "@/lib/format";
import type { DataTableColumn } from "@/shared/ui/DataTable";
import { DataTable } from "@/shared/ui/DataTable";
import { DateRangePicker, type DateRangeValue } from "@/shared/ui/DateRangePicker";
import { DrillStack } from "@/shared/ui/DrillStack";
import { GroupByChip, GroupByChipGroup } from "@/shared/ui/GroupByChip";
import { KpiCard } from "@/shared/ui/KpiCard";
import { LastSyncedBadge } from "@/shared/ui/LastSyncedBadge";
import { Button } from "@/shared/ui/button";
import { ForecastBar } from "@/shared/charts/ForecastBar";
import { StackedAreaUsage } from "@/shared/charts/StackedAreaUsage";
import type { ForecastResult } from "@shared/api/aggregator";
import { Clock, Coins, Flame, ListChecks, TimerReset } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { DailyResourceBucket, ResourceMixSlice } from "../aggregations";
import type { Job, QueueWaitTime } from "../schemas";
import { AnalyticsCard } from "./AnalyticsCard";
import { ResourceMixDonut } from "./ResourceMixDonut";
import { WaitTimeBars } from "./WaitTimeBars";

export type ResearcherKpiBundle = {
  usedSUs: number;
  burnRatePerDay: number;
  daysLeft: number | null;
  jobsRun: number;
  avgWaitSeconds: number;
  usedSparkline: number[];
};

export type ResearcherForecastBundle = {
  used: number;
  projected: number;
  capacity: number;
  forecast: ForecastResult;
  endDate: string | null;
  primaryAllocationId: string | null;
  primaryAllocationName: string | null;
};

export type ResearcherAnalyticsProps = {
  syncedAt: Date;
  onRefetch?: () => void;
  range: DateRangeValue;
  onRangeChange: (next: DateRangeValue) => void;
  groupBy: string;
  onGroupByChange: (next: string) => void;
  kpis: ResearcherKpiBundle;
  forecastBundle: ResearcherForecastBundle;
  daily: { rows: DailyResourceBucket[]; seriesKeys: string[] };
  waitTimes: QueueWaitTime[];
  resourceMix: ResourceMixSlice[];
  recentJobs: Job[];
};

const GROUP_BY_OPTIONS = [
  { value: "resource", label: "Resource" },
  { value: "project", label: "Project" },
];

function fmtWaitSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

function fmtBurn(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  return `${formatNumber(Math.round(rate))}/d`;
}

function jobColumns(): Array<DataTableColumn<Job>> {
  return [
    { key: "job_id", header: "Job ID", cell: (row) => row.job_id },
    { key: "resource_id", header: "Resource", cell: (row) => row.resource_id },
    {
      key: "started_at",
      header: "Started",
      cell: (row) => formatDate(row.started_at),
    },
    {
      key: "su_used",
      header: "SUs",
      align: "right",
      cell: (row) => formatNumber(row.su_used),
    },
    {
      key: "wait_seconds",
      header: "Wait",
      align: "right",
      cell: (row) => fmtWaitSeconds(row.wait_seconds),
    },
    { key: "status", header: "Status", cell: (row) => row.status },
  ];
}

type DrillState =
  | { kind: "none" }
  | { kind: "resource"; resource_id: string; jobs: Job[] }
  | { kind: "queue"; queue: string };

export function ResearcherAnalytics(props: ResearcherAnalyticsProps) {
  const {
    syncedAt,
    onRefetch,
    range,
    onRangeChange,
    groupBy,
    onGroupByChange,
    kpis,
    forecastBundle,
    daily,
    waitTimes,
    resourceMix,
    recentJobs,
  } = props;

  const [drill, setDrill] = React.useState<DrillState>({ kind: "none" });

  const exhaustCaption = React.useMemo(() => {
    const { forecast } = forecastBundle;
    if (forecast.method === "insufficient-data" || !forecast.exhaustDate) {
      return "Not enough data for a 7-day forecast.";
    }
    if (!forecastBundle.endDate) return `Projected exhaust ${formatDate(forecast.exhaustDate.toISOString())}.`;
    const end = new Date(forecastBundle.endDate);
    const diffDays = Math.round(
      (forecast.exhaustDate.getTime() - end.getTime()) / (24 * 60 * 60 * 1000),
    );
    const direction = diffDays < 0 ? "before" : "after";
    return `Projected exhaust ${formatDate(forecast.exhaustDate.toISOString())} — ${Math.abs(
      diffDays,
    )} days ${direction} award end.`;
  }, [forecastBundle]);

  const detailLink = forecastBundle.primaryAllocationId
    ? `/allocations/${forecastBundle.primaryAllocationId}?tab=credits`
    : null;

  return (
    <section className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <h1
            className="font-display text-[28px] font-bold leading-tight text-foreground"
            data-testid="analytics-title"
          >
            Analytics
          </h1>
          <span className="text-sm text-muted-foreground">
            Viewing as:{" "}
            <span className="font-medium text-foreground" data-testid="analytics-viewing-as">
              Researcher
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3" data-testid="analytics-toolbar">
          <LastSyncedBadge syncedAt={syncedAt} onRefetch={onRefetch} />
          <DateRangePicker value={range} onChange={onRangeChange} />
          <GroupByChipGroup>
            <GroupByChip
              label="Group by"
              value={groupBy}
              options={GROUP_BY_OPTIONS}
              onChange={onGroupByChange}
            />
          </GroupByChipGroup>
          {/* Saved views land in A4. */}
          <Button variant="outline" size="sm" disabled>
            + Save view
          </Button>
        </div>
      </header>

      <div
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5"
        data-testid="analytics-kpi-strip"
      >
        <KpiCard
          icon={Coins}
          title="Used SUs"
          value={formatNumber(kpis.usedSUs)}
          sparkline={kpis.usedSparkline.length > 0 ? kpis.usedSparkline : undefined}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Flame}
          title="Burn rate"
          value={fmtBurn(kpis.burnRatePerDay)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={TimerReset}
          title="Days left"
          value={kpis.daysLeft === null ? "—" : `${kpis.daysLeft} d`}
          deltaTone="neutral"
        />
        <KpiCard
          icon={ListChecks}
          title="Jobs run"
          value={formatNumber(kpis.jobsRun)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Clock}
          title="Avg wait"
          value={fmtWaitSeconds(kpis.avgWaitSeconds)}
          deltaTone="neutral"
        />
      </div>

      <AnalyticsCard
        title="Burn vs allocated"
        subtitle={forecastBundle.primaryAllocationName ?? "Primary active allocation"}
        rightSlot={
          detailLink ? (
            <Link href={detailLink} className="text-brand hover:underline">
              Detail →
            </Link>
          ) : null
        }
      >
        <ForecastBar
          used={forecastBundle.used}
          projected={forecastBundle.projected}
          capacity={forecastBundle.capacity}
          exhaustDate={forecastBundle.forecast.exhaustDate ?? undefined}
          endDate={forecastBundle.endDate ?? undefined}
          label={forecastBundle.primaryAllocationName ?? undefined}
        />
        <p className="mt-2 text-xs text-muted-foreground" data-testid="analytics-exhaust-caption">
          {exhaustCaption}
        </p>
      </AnalyticsCard>

      <AnalyticsCard title="Daily SU consumption" subtitle={`by ${groupBy}`}>
        {daily.rows.length === 0 || daily.seriesKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage in this window.</p>
        ) : (
          <button
            type="button"
            data-testid="analytics-daily-chart"
            // Click anywhere on the chart opens the drilldown for the first
            // series — keeps A1 small while honoring the §8 "chart segment
            // click opens DrillStack" conformance rule.
            onClick={() => {
              const key = daily.seriesKeys[0];
              if (!key) return;
              setDrill({
                kind: "resource",
                resource_id: key,
                jobs: recentJobs.filter((j) => j.resource_id === key),
              });
            }}
            className="block w-full cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StackedAreaUsage data={daily.rows} seriesKeys={daily.seriesKeys} />
          </button>
        )}
      </AnalyticsCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Wait time by queue" subtitle="Average across the window">
          {waitTimes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No queue data in this window.</p>
          ) : (
            <WaitTimeBars data={waitTimes} />
          )}
        </AnalyticsCard>
        <AnalyticsCard title="Resource mix" subtitle="Hours per resource">
          {resourceMix.length === 0 ? (
            <p className="text-sm text-muted-foreground">No resource consumption in this window.</p>
          ) : (
            <ResourceMixDonut data={resourceMix} />
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsCard title="Recent jobs" subtitle="Top 25 by SU">
        <DataTable
          columns={jobColumns()}
          rows={recentJobs}
          rowKey={(row) => row.job_id}
          caption="Recent jobs"
          empty={<span className="text-sm text-muted-foreground">No jobs in this window.</span>}
        />
      </AnalyticsCard>

      <DrillStack
        open={drill.kind !== "none"}
        onClose={() => setDrill({ kind: "none" })}
        title={
          drill.kind === "resource"
            ? `Resource ${drill.resource_id}`
            : drill.kind === "queue"
              ? `Queue ${drill.queue}`
              : "Drill"
        }
        crumbs={[
          {
            label: "Researcher analytics",
            onPop: () => setDrill({ kind: "none" }),
          },
        ]}
      >
        {drill.kind === "resource" ? (
          <DataTable
            columns={jobColumns()}
            rows={drill.jobs}
            rowKey={(row) => row.job_id}
            empty={
              <span className="text-sm text-muted-foreground">No jobs charged to this resource.</span>
            }
          />
        ) : null}
      </DrillStack>
    </section>
  );
}
