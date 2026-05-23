"use client";

import { formatNumber } from "@/lib/format";
import type { DataTableColumn } from "@/shared/ui/DataTable";
import { DataTable } from "@/shared/ui/DataTable";
import { DateRangePicker, type DateRangeValue } from "@/shared/ui/DateRangePicker";
import { DrillStack } from "@/shared/ui/DrillStack";
import { GroupByChip, GroupByChipGroup } from "@/shared/ui/GroupByChip";
import { KpiCard } from "@/shared/ui/KpiCard";
import { LastSyncedBadge } from "@/shared/ui/LastSyncedBadge";
import {
  MostUsedResourceCallout,
  type MostUsedResourceCalloutRow,
} from "@/shared/ui/MostUsedResourceCallout";
import { StatCardRow } from "@/shared/ui/StatCardRow";
import { Button } from "@/shared/ui/button";
import {
  ComplianceMatrix,
  type ComplianceCell,
} from "@/shared/charts/ComplianceMatrix";
import { StackedAreaUsage } from "@/shared/charts/StackedAreaUsage";
import { Coins, Cpu, ListTree, Users } from "lucide-react";
import * as React from "react";
import type { DailyResourceBucket } from "../aggregations";
import { AnalyticsCard } from "./AnalyticsCard";

export type ResourcesGroupBy = "allocation" | "user" | "project";

export type ResourcesKpiBundle = {
  totalSus: number;
  topResourceLabel: string;
  topAllocationLabel: string;
  topUserLabel: string;
};

export type ResourcesGroupRow = {
  key: string;
  label: string;
  total_su: number;
  share_pct: number;
};

export type ResourcesMatrixResource = {
  id: string;
  name: string;
};

export type ResourcesMatrixGroup = {
  key: string;
  label: string;
};

export type ResourcesAnalyticsProps = {
  syncedAt: Date;
  onRefetch?: () => void;
  range: DateRangeValue;
  onRangeChange: (next: DateRangeValue) => void;
  groupBy: ResourcesGroupBy;
  onGroupByChange: (next: ResourcesGroupBy) => void;
  personaLabel: string;
  scopeNote: string;
  kpis: ResourcesKpiBundle;
  callout: MostUsedResourceCalloutRow[];
  daily: { rows: DailyResourceBucket[]; seriesKeys: string[] };
  matrixResources: ResourcesMatrixResource[];
  matrixGroups: ResourcesMatrixGroup[];
  matrixCell: (
    resource: ResourcesMatrixResource,
    group: ResourcesMatrixGroup,
  ) => ComplianceCell | null;
  topConsumers: ResourcesGroupRow[];
  // Toolbar slot for the saved-views row — composed at the container layer so
  // feature components don't import the views feature module directly (A4 §1).
  savedViewsChips?: React.ReactNode;
  saveViewTrigger?: React.ReactNode;
};

// Single-chip GroupBy. The Resources tab cuts one dimension at a time —
// the data is wide enough that letting the user combine "by user × by
// project" would blow the matrix open. The persona-distinct page layouts
// don't materialize here because the data shape is the same — admin's only
// difference is scope (site-wide), not surface.
const GROUP_BY_OPTIONS: Array<{ value: ResourcesGroupBy; label: string }> = [
  { value: "allocation", label: "By allocation" },
  { value: "user", label: "By user" },
  { value: "project", label: "By project" },
];

function consumerColumns(
  groupBy: ResourcesGroupBy,
): Array<DataTableColumn<ResourcesGroupRow>> {
  const header = groupBy === "user" ? "User" : groupBy === "project" ? "Project" : "Allocation";
  return [
    { key: "label", header, cell: (row) => <span className="font-medium text-foreground">{row.label}</span> },
    {
      key: "total_su",
      header: "Total SUs",
      align: "right",
      cell: (row) => <span className="tabular-nums">{formatNumber(row.total_su)}</span>,
    },
    {
      key: "share_pct",
      header: "Share",
      align: "right",
      cell: (row) => <span className="tabular-nums">{row.share_pct.toFixed(1)}%</span>,
    },
  ];
}

type DrillState =
  | { kind: "none" }
  | { kind: "callout"; resource: MostUsedResourceCalloutRow }
  | { kind: "matrix"; resource: ResourcesMatrixResource; group: ResourcesMatrixGroup; total: number }
  | { kind: "consumer"; row: ResourcesGroupRow };

export function ResourcesAnalytics(props: ResourcesAnalyticsProps) {
  const {
    syncedAt,
    onRefetch,
    range,
    onRangeChange,
    groupBy,
    onGroupByChange,
    personaLabel,
    scopeNote,
    kpis,
    callout,
    daily,
    matrixResources,
    matrixGroups,
    matrixCell,
    topConsumers,
    savedViewsChips,
    saveViewTrigger,
  } = props;

  const [drill, setDrill] = React.useState<DrillState>({ kind: "none" });
  const groupLabelSingular =
    groupBy === "user" ? "user" : groupBy === "project" ? "project" : "allocation";

  return (
    <section className="space-y-6" data-testid="analytics-resources">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <h1
            className="font-display text-[28px] font-bold leading-tight text-foreground"
            data-testid="analytics-title"
          >
            Resources
          </h1>
          <span className="text-sm text-muted-foreground">
            Viewing as:{" "}
            <span className="font-medium text-foreground" data-testid="analytics-viewing-as">
              {personaLabel}
            </span>
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{scopeNote}</p>
        <div
          className="flex flex-wrap items-center gap-3"
          data-testid="analytics-resources-toolbar"
        >
          <LastSyncedBadge syncedAt={syncedAt} onRefetch={onRefetch} />
          <DateRangePicker value={range} onChange={onRangeChange} />
          <GroupByChipGroup>
            <GroupByChip
              label="Group"
              value={groupBy}
              options={GROUP_BY_OPTIONS}
              onChange={(next) => onGroupByChange(next as ResourcesGroupBy)}
            />
          </GroupByChipGroup>
          {savedViewsChips}
          {saveViewTrigger ?? (
            <Button variant="outline" size="sm" disabled>
              + Save view
            </Button>
          )}
        </div>
      </header>

      <StatCardRow cols={4} data-testid="analytics-resources-kpi-strip">
        <KpiCard
          icon={Coins}
          title="Total SUs used"
          value={formatNumber(kpis.totalSus)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Cpu}
          title="Top resource"
          value={kpis.topResourceLabel || "—"}
          deltaTone="neutral"
        />
        <KpiCard
          icon={ListTree}
          title="Top allocation"
          value={kpis.topAllocationLabel || "—"}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Users}
          title="Most-active user"
          value={kpis.topUserLabel || "—"}
          deltaTone="neutral"
        />
      </StatCardRow>

      <AnalyticsCard title="Most-used resource" subtitle="Top 5 by share of SUs">
        <MostUsedResourceCallout
          resources={callout}
          topN={5}
          onRowClick={(row) => setDrill({ kind: "callout", resource: row })}
        />
      </AnalyticsCard>

      <AnalyticsCard title="Usage over time" subtitle="Stacked by resource">
        {daily.rows.length === 0 || daily.seriesKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage in this window.</p>
        ) : (
          <StackedAreaUsage
            data={daily.rows}
            seriesKeys={daily.seriesKeys}
            ariaLabel="Daily resource usage stacked by resource"
            onSegmentClick={(seriesKey) => {
              const resource = matrixResources.find((r) => r.id === seriesKey);
              if (!resource) return;
              const fallbackGroup =
                matrixGroups[0] ?? ({ key: "__all__", label: "All" } as ResourcesMatrixGroup);
              const cell = matrixCell(resource, fallbackGroup);
              setDrill({
                kind: "matrix",
                resource,
                group: fallbackGroup,
                total: cell?.value ?? 0,
              });
            }}
          />
        )}
      </AnalyticsCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsCard
          title={`Resource × ${capitalize(groupLabelSingular)} matrix`}
          subtitle="Top 10 of each — click a cell to drill"
        >
          {matrixResources.length === 0 || matrixGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No usage in this window.</p>
          ) : (
            <ComplianceMatrix
              rows={matrixResources}
              cols={matrixGroups}
              rowLabel={(r) => r.name}
              colLabel={(c) => c.label}
              cell={(r, c) => matrixCell(r, c)}
              formatValue={(cell) => formatNumber(cell.value)}
              onCellClick={(r, c) => {
                const cell = matrixCell(r, c);
                setDrill({
                  kind: "matrix",
                  resource: r,
                  group: c,
                  total: cell?.value ?? 0,
                });
              }}
            />
          )}
        </AnalyticsCard>

        <AnalyticsCard
          title={`Top ${groupLabelSingular}s`}
          subtitle="Folded over the active window"
        >
          <DataTable
            columns={consumerColumns(groupBy)}
            rows={topConsumers}
            rowKey={(row) => row.key}
            caption={`Top ${groupLabelSingular}s by SU usage`}
            empty={
              <span className="text-sm text-muted-foreground">
                No {groupLabelSingular} usage in this window.
              </span>
            }
            onRowClick={(row) => setDrill({ kind: "consumer", row })}
          />
        </AnalyticsCard>
      </div>

      <DrillStack
        open={drill.kind !== "none"}
        onClose={() => setDrill({ kind: "none" })}
        title={drillTitle(drill)}
        crumbs={[
          {
            label: `${personaLabel} resources`,
            onPop: () => setDrill({ kind: "none" }),
          },
        ]}
      >
        {drill.kind === "callout" ? (
          <DrillBody
            primaryLabel="Resource"
            primaryValue={drill.resource.name}
            stats={[
              { label: "Used SUs", value: formatNumber(drill.resource.used_su) },
              { label: "Share of window", value: `${drill.resource.share_pct.toFixed(1)}%` },
            ]}
            note={`Per-${groupLabelSingular} breakdown follows the active Group-by chip — switch it to slice differently without leaving this drawer.`}
          />
        ) : null}
        {drill.kind === "matrix" ? (
          <DrillBody
            primaryLabel="Resource × group"
            primaryValue={`${drill.resource.name} × ${drill.group.label}`}
            stats={[{ label: "SUs charged", value: formatNumber(drill.total) }]}
            note="Cell totals exclude rows whose group key is missing in the seed — usage rows without a project/user mapping are dropped to keep cuts comparable."
          />
        ) : null}
        {drill.kind === "consumer" ? (
          <DrillBody
            primaryLabel={capitalize(groupLabelSingular)}
            primaryValue={drill.row.label}
            stats={[
              { label: "Total SUs", value: formatNumber(drill.row.total_su) },
              { label: "Share of window", value: `${drill.row.share_pct.toFixed(1)}%` },
            ]}
            note={`Drill back via the persona analytics tab for time-series detail on this ${groupLabelSingular}.`}
          />
        ) : null}
      </DrillStack>
    </section>
  );
}

type DrillStat = { label: string; value: string };

type DrillBodyProps = {
  primaryLabel: string;
  primaryValue: string;
  stats: DrillStat[];
  note?: string;
};

function DrillBody({ primaryLabel, primaryValue, stats, note }: DrillBodyProps) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{primaryLabel}</p>
        <p className="font-heading text-lg font-semibold text-foreground">{primaryValue}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 text-sm">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="font-medium tabular-nums text-foreground">{s.value}</dd>
          </div>
        ))}
      </dl>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function drillTitle(drill: DrillState): string {
  if (drill.kind === "callout") return `Resource: ${drill.resource.name}`;
  if (drill.kind === "matrix") return `${drill.resource.name} × ${drill.group.label}`;
  if (drill.kind === "consumer") return drill.row.label;
  return "Drill";
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
