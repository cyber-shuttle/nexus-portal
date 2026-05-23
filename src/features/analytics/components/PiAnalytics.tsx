"use client";

import { formatDate, formatNumber } from "@/lib/format";
import type { DataTableColumn } from "@/shared/ui/DataTable";
import { DataTable } from "@/shared/ui/DataTable";
import { DateRangePicker, type DateRangeValue } from "@/shared/ui/DateRangePicker";
import { DrillStack } from "@/shared/ui/DrillStack";
import { EmptyState } from "@/shared/ui/EmptyState";
import { GroupByChip, GroupByChipGroup } from "@/shared/ui/GroupByChip";
import { KpiCard } from "@/shared/ui/KpiCard";
import { LastSyncedBadge } from "@/shared/ui/LastSyncedBadge";
import { StatCardRow } from "@/shared/ui/StatCardRow";
import { Button } from "@/shared/ui/button";
import { ForecastBar } from "@/shared/charts/ForecastBar";
import { StackedAreaUsage } from "@/shared/charts/StackedAreaUsage";
import {
  AlertTriangle,
  ClipboardList,
  Coins,
  FolderKanban,
  Gauge,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type {
  DailyResourceBucket,
  MemberContribution,
  PiProjectRollup,
  ResourceMixSlice,
} from "../aggregations";
import { AnalyticsCard } from "./AnalyticsCard";
import { ResourceMixDonut } from "./ResourceMixDonut";
import { TopNBarChart } from "./TopNBarChart";

export type PiKpiBundle = {
  activeProjects: number;
  totalSuUsed: number;
  avgBurnPerProject: number;
  projectsAtRisk: number;
  pendingChangeRequests: number;
};

export type PiAnalyticsProps = {
  syncedAt: Date;
  onRefetch?: () => void;
  range: DateRangeValue;
  onRangeChange: (next: DateRangeValue) => void;
  groupByProject: string;
  onGroupByProjectChange: (next: string) => void;
  groupByMember: string;
  onGroupByMemberChange: (next: string) => void;
  groupByResource: string;
  onGroupByResourceChange: (next: string) => void;
  kpis: PiKpiBundle;
  topProjects: PiProjectRollup[];
  usageByProject: { rows: DailyResourceBucket[]; seriesKeys: string[] };
  topMembers: MemberContribution[];
  memberUsageByAllocation: Record<string, Array<{ allocation_id: string; total: number }>>;
  resourceMix: ResourceMixSlice[];
  projects: PiProjectRollup[];
  // Toolbar slot for the saved-views row — composed at the container layer so
  // feature components don't import the views feature module directly (spec
  // §5.2 + A4 §1). One slot for chips, one for the Save trigger.
  savedViewsChips?: React.ReactNode;
  saveViewTrigger?: React.ReactNode;
};

const PROJECT_OPTIONS = [
  { value: "all", label: "All projects" },
  { value: "project", label: "By project" },
];

const MEMBER_OPTIONS = [
  { value: "all", label: "All members" },
  { value: "member", label: "By member" },
];

const RESOURCE_OPTIONS = [
  { value: "all", label: "All resources" },
  { value: "resource", label: "By resource" },
];

function fmtBurn(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  return `${formatNumber(Math.round(rate))}/mo`;
}

function fmtForecastEnd(d: Date | null): string {
  if (!d) return "—";
  return formatDate(d.toISOString());
}

type DrillState = { kind: "none" } | { kind: "member"; userId: string };

export function PiAnalytics(props: PiAnalyticsProps) {
  const {
    syncedAt,
    onRefetch,
    range,
    onRangeChange,
    groupByProject,
    onGroupByProjectChange,
    groupByMember,
    onGroupByMemberChange,
    groupByResource,
    onGroupByResourceChange,
    kpis,
    topProjects,
    usageByProject,
    topMembers,
    memberUsageByAllocation,
    resourceMix,
    projects,
    savedViewsChips,
    saveViewTrigger,
  } = props;

  const router = useRouter();
  const [drill, setDrill] = React.useState<DrillState>({ kind: "none" });

  const projectColumns = React.useMemo<Array<DataTableColumn<PiProjectRollup>>>(
    () => [
      { key: "project", header: "Project", cell: (row) => row.projectName },
      {
        key: "used",
        header: "Used / Allocated",
        align: "right",
        cell: (row) => `${formatNumber(row.used)} / ${formatNumber(row.allocated)}`,
      },
      {
        key: "percent",
        header: "%",
        align: "right",
        cell: (row) =>
          row.allocated > 0
            ? `${Math.round((row.used / row.allocated) * 100)}%`
            : "—",
      },
      {
        key: "forecast",
        header: "Forecast end",
        cell: (row) => fmtForecastEnd(row.forecastExhaust),
      },
      {
        key: "pending",
        header: "Pending CRs",
        align: "right",
        cell: (row) => row.pendingChangeRequests,
      },
    ],
    [],
  );

  // Click a project row -> open the first allocation's detail page (spec §6.2
  // bottom table contract). Rows without an allocation are non-interactive.
  const onProjectRowClick = (row: PiProjectRollup) => {
    if (row.firstAllocationId) router.push(`/allocations/${row.firstAllocationId}`);
  };

  const memberBarData = React.useMemo(
    () =>
      topMembers.map((m) => ({
        label: m.user_id,
        value: m.total,
        key: m.user_id,
      })),
    [topMembers],
  );

  const drilledMemberRows =
    drill.kind === "member" ? (memberUsageByAllocation[drill.userId] ?? []) : [];

  // A2 N3 carry-over: empty-projects PI passes the CASL gate but has nothing
  // to render — show a soft, explanatory empty state instead of a 403-style
  // page. The link-projects action lives in admin scope so no CTA.
  if (projects.length === 0) {
    return (
      <section className="space-y-6">
        <header className="flex items-center justify-between">
          <h1
            className="font-display text-[28px] font-bold leading-tight text-foreground"
            data-testid="analytics-title"
          >
            Analytics
          </h1>
          <span className="text-sm text-muted-foreground">
            Viewing as:{" "}
            <span className="font-medium text-foreground" data-testid="analytics-viewing-as">
              PI
            </span>
          </span>
        </header>
        <EmptyState
          heading="No projects yet"
          description="You're listed as a PI on allocations but don't own any projects. Ask an admin to link them."
        />
      </section>
    );
  }

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
              PI
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3" data-testid="analytics-toolbar">
          <LastSyncedBadge syncedAt={syncedAt} onRefetch={onRefetch} />
          <DateRangePicker value={range} onChange={onRangeChange} />
          <GroupByChipGroup>
            <GroupByChip
              label="Project"
              value={groupByProject}
              options={PROJECT_OPTIONS}
              onChange={onGroupByProjectChange}
            />
            <GroupByChip
              label="Member"
              value={groupByMember}
              options={MEMBER_OPTIONS}
              onChange={onGroupByMemberChange}
            />
            <GroupByChip
              label="Resource"
              value={groupByResource}
              options={RESOURCE_OPTIONS}
              onChange={onGroupByResourceChange}
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

      <StatCardRow cols={5} data-testid="analytics-kpi-strip">
        <KpiCard
          icon={FolderKanban}
          title="Active projects"
          value={formatNumber(kpis.activeProjects)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Coins}
          title="Total SU used"
          value={formatNumber(kpis.totalSuUsed)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Gauge}
          title="Avg burn /project"
          value={fmtBurn(kpis.avgBurnPerProject)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={AlertTriangle}
          title="Projects at risk"
          value={formatNumber(kpis.projectsAtRisk)}
          deltaTone={kpis.projectsAtRisk > 0 ? "negative" : "neutral"}
        />
        <KpiCard
          icon={ClipboardList}
          title="Pending change-requests"
          value={formatNumber(kpis.pendingChangeRequests)}
          deltaTone={kpis.pendingChangeRequests > 0 ? "negative" : "neutral"}
        />
      </StatCardRow>

      <AnalyticsCard title="Burn by project (top 6)">
        {topProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project usage in this window.</p>
        ) : (
          <div className="space-y-4" data-testid="pi-burn-by-project">
            {topProjects.map((p) => (
              <ForecastBar
                key={p.projectId}
                label={p.projectName}
                used={p.used}
                projected={p.projected}
                capacity={p.allocated}
                exhaustDate={p.forecastExhaust ?? undefined}
                endDate={p.endDate ?? undefined}
                onClick={
                  p.firstAllocationId
                    ? () => router.push(`/allocations/${p.firstAllocationId}`)
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </AnalyticsCard>

      <AnalyticsCard title="Usage trend" subtitle="by project">
        {usageByProject.rows.length === 0 || usageByProject.seriesKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage in this window.</p>
        ) : (
          <StackedAreaUsage
            data={usageByProject.rows}
            seriesKeys={usageByProject.seriesKeys}
            ariaLabel="Usage trend stacked by project"
          />
        )}
      </AnalyticsCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Member contribution" subtitle="Top 10 + Other">
          {topMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No member usage in this window.</p>
          ) : (
            <div data-testid="pi-member-contribution">
              <TopNBarChart
                data={memberBarData}
                ariaLabel="Member contribution"
                onBarClick={(d) =>
                  d.key === "Other" ? null : setDrill({ kind: "member", userId: d.key })
                }
              />
            </div>
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

      <AnalyticsCard title="Projects">
        <DataTable
          columns={projectColumns}
          rows={projects}
          rowKey={(row) => row.projectId}
          onRowClick={onProjectRowClick}
          caption="Projects rollup"
          empty={
            <span className="text-sm text-muted-foreground">No projects to show.</span>
          }
        />
      </AnalyticsCard>

      <DrillStack
        open={drill.kind !== "none"}
        onClose={() => setDrill({ kind: "none" })}
        title={drill.kind === "member" ? `Member ${drill.userId}` : "Drill"}
        crumbs={[
          {
            label: "PI analytics",
            onPop: () => setDrill({ kind: "none" }),
          },
        ]}
      >
        {drill.kind === "member" ? (
          <DataTable
            columns={[
              { key: "alloc", header: "Allocation", cell: (r) => r.allocation_id },
              {
                key: "total",
                header: "Used SUs",
                align: "right",
                cell: (r) => formatNumber(r.total),
              },
            ]}
            rows={drilledMemberRows}
            rowKey={(row) => row.allocation_id}
            empty={
              <span className="text-sm text-muted-foreground">No usage charged to this member.</span>
            }
          />
        ) : null}
      </DrillStack>
    </section>
  );
}
