"use client";

import { formatDate, formatNumber } from "@/lib/format";
import type { DataTableColumn } from "@/shared/ui/DataTable";
import { DataTable } from "@/shared/ui/DataTable";
import { DateRangePicker, type DateRangeValue } from "@/shared/ui/DateRangePicker";
import { GroupByChip, GroupByChipGroup } from "@/shared/ui/GroupByChip";
import { KpiCard } from "@/shared/ui/KpiCard";
import { LastSyncedBadge } from "@/shared/ui/LastSyncedBadge";
import { StatCardRow } from "@/shared/ui/StatCardRow";
import { Button } from "@/shared/ui/button";
import { ComplianceMatrix } from "@/shared/charts/ComplianceMatrix";
import type { ComplianceBand } from "@shared/api/aggregator";
import { StackedAreaUsage } from "@/shared/charts/StackedAreaUsage";
import {
  AlertOctagon,
  Coins,
  FolderKanban,
  Gauge,
  Send,
  XOctagon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type {
  AdminAtRiskRow,
  AdminProjectBurn,
  DailyResourceBucket,
} from "../aggregations";
import { AnalyticsCard } from "./AnalyticsCard";
import { TopNBarChart } from "./TopNBarChart";

export type AdminKpiBundle = {
  siteSuUsed: number;
  clusterUtilPct: number;
  activeProjects: number;
  amiePacketsPerDay: number;
  failedPackets24h: number;
};

export type AdminMatrixProject = {
  id: string;
  code: string;
  title: string;
};

export type AdminMatrixResource = {
  id: string;
  name: string;
};

export type AdminAnalyticsProps = {
  syncedAt: Date;
  onRefetch?: () => void;
  range: DateRangeValue;
  onRangeChange: (next: DateRangeValue) => void;
  groupByResource: string;
  onGroupByResourceChange: (next: string) => void;
  groupByProject: string;
  onGroupByProjectChange: (next: string) => void;
  groupByOrg: string;
  onGroupByOrgChange: (next: string) => void;
  kpis: AdminKpiBundle;
  clusterUtilization: { rows: DailyResourceBucket[]; seriesKeys: string[] };
  topProjects: AdminProjectBurn[];
  amieFlow: { rows: DailyResourceBucket[]; seriesKeys: string[] };
  matrixProjects: AdminMatrixProject[];
  matrixResources: AdminMatrixResource[];
  matrixCell: (
    project: AdminMatrixProject,
    resource: AdminMatrixResource,
  ) => { value: number; band: ComplianceBand } | null;
  matrixCellAllocationId: (
    project: AdminMatrixProject,
    resource: AdminMatrixResource,
  ) => string | null;
  atRisk: AdminAtRiskRow[];
  // Caption rendered under the matrix when per-(project, resource) capacity is
  // an approximation (even split across the project's used resources). Off when
  // the backend ships exact per-resource budgets — see F3 in A3 gate.
  matrixApproximate?: boolean;
  // Fired when a packet-flow segment is clicked; container builds the deep-link
  // URL because date format depends on URL state (spec §6.3, A3 F2).
  onAmieSegmentClick?: (seriesKey: string, date: string) => void;
  // Toolbar slot for the saved-views row — composed at the container layer so
  // feature components don't import the views feature module directly (A4 §1).
  savedViewsChips?: React.ReactNode;
  saveViewTrigger?: React.ReactNode;
};

const RESOURCE_OPTIONS = [
  { value: "all", label: "All resources" },
  { value: "resource", label: "By resource" },
];

const PROJECT_OPTIONS = [
  { value: "all", label: "All projects" },
  { value: "project", label: "By project" },
];

const ORG_OPTIONS = [
  { value: "all", label: "All orgs" },
  { value: "org", label: "By org" },
];

function fmtPct(ratio: number, digits = 0): string {
  if (!Number.isFinite(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return formatDate(d.toISOString());
}

export function AdminAnalytics(props: AdminAnalyticsProps) {
  const {
    syncedAt,
    onRefetch,
    range,
    onRangeChange,
    groupByResource,
    onGroupByResourceChange,
    groupByProject,
    onGroupByProjectChange,
    groupByOrg,
    onGroupByOrgChange,
    kpis,
    clusterUtilization,
    topProjects,
    amieFlow,
    matrixProjects,
    matrixResources,
    matrixCell,
    matrixCellAllocationId,
    atRisk,
    matrixApproximate,
    onAmieSegmentClick,
    savedViewsChips,
    saveViewTrigger,
  } = props;

  const router = useRouter();

  const topProjectsBarData = React.useMemo(
    () =>
      topProjects.map((p) => ({
        label: p.projectName,
        value: p.used,
        key: p.projectId,
      })),
    [topProjects],
  );

  // Forward analytics range to drill-down destinations (A3 F7) so the
  // allocation detail page can preserve the window the user was looking at.
  const rangeParams = React.useMemo(() => {
    const p = new URLSearchParams();
    p.set("from", range.from.toISOString());
    p.set("to", range.to.toISOString());
    return p;
  }, [range.from, range.to]);

  // The compliance matrix routes to the first allocation found at the
  // project × resource intersection (spec §6.3: "Cell click → /allocations/:id?tab=credits").
  const onMatrixCellClick = (project: AdminMatrixProject, resource: AdminMatrixResource) => {
    const id = matrixCellAllocationId(project, resource);
    if (!id) return;
    const p = new URLSearchParams(rangeParams);
    p.set("tab", "credits");
    router.push(`/allocations/${id}?${p.toString()}`);
  };

  const onTopProjectClick = (datum: { key: string }) => {
    const project = topProjects.find((p) => p.projectId === datum.key);
    if (project?.firstAllocationId) {
      router.push(`/allocations/${project.firstAllocationId}?${rangeParams.toString()}`);
    }
  };

  const atRiskColumns = React.useMemo<Array<DataTableColumn<AdminAtRiskRow>>>(
    () => [
      { key: "project", header: "Project", cell: (row) => row.projectName },
      {
        key: "resource",
        header: "Resource",
        cell: (row) => row.resourceName ?? "—",
      },
      {
        key: "usedPct",
        header: "% used",
        align: "right",
        cell: (row) => `${Math.round(row.usedPct)}%`,
      },
      {
        key: "daysToExhaust",
        header: "Days to exhaust",
        align: "right",
        cell: (row) =>
          row.daysToExhaust === null ? "—" : `${Math.max(0, Math.round(row.daysToExhaust))}`,
      },
      {
        key: "endDate",
        header: "End date",
        cell: (row) => fmtDate(row.endDate),
      },
      { key: "owner", header: "Owner", cell: (row) => row.ownerId },
    ],
    [],
  );

  // AMIE packet flow deep-links to the AMIE packets console with the clicked
  // status pre-filtered (spec §6.3).
  const amieDeepLinkHref = "/admin/amie/packets?status=FAILED";

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
              Admin
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3" data-testid="analytics-toolbar">
          <LastSyncedBadge syncedAt={syncedAt} onRefetch={onRefetch} />
          <DateRangePicker value={range} onChange={onRangeChange} />
          <GroupByChipGroup>
            <GroupByChip
              label="Resource"
              value={groupByResource}
              options={RESOURCE_OPTIONS}
              onChange={onGroupByResourceChange}
            />
            <GroupByChip
              label="Project"
              value={groupByProject}
              options={PROJECT_OPTIONS}
              onChange={onGroupByProjectChange}
            />
            <GroupByChip
              label="Org"
              value={groupByOrg}
              options={ORG_OPTIONS}
              onChange={onGroupByOrgChange}
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
          icon={Coins}
          title="Site SU used"
          value={formatNumber(kpis.siteSuUsed)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Gauge}
          title="Cluster util %"
          value={fmtPct(kpis.clusterUtilPct, 0)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={FolderKanban}
          title="Active projects"
          value={formatNumber(kpis.activeProjects)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={Send}
          title="AMIE packets/day"
          value={formatNumber(kpis.amiePacketsPerDay)}
          deltaTone="neutral"
        />
        <KpiCard
          icon={XOctagon}
          title="Failed packets (24h)"
          value={formatNumber(kpis.failedPackets24h)}
          deltaTone={kpis.failedPackets24h > 0 ? "negative" : "neutral"}
        />
      </StatCardRow>

      <AnalyticsCard
        title="Cluster utilization"
        subtitle="last 30 days, by resource"
      >
        {clusterUtilization.rows.length === 0 || clusterUtilization.seriesKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage in this window.</p>
        ) : (
          <div data-testid="admin-cluster-util">
            <StackedAreaUsage
              data={clusterUtilization.rows}
              seriesKeys={clusterUtilization.seriesKeys}
              ariaLabel="Cluster utilization stacked by resource"
            />
          </div>
        )}
      </AnalyticsCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsCard title="Top projects (burn)">
          {topProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No project usage in this window.</p>
          ) : (
            <div data-testid="admin-top-projects">
              <TopNBarChart
                data={topProjectsBarData}
                ariaLabel="Top projects by burn"
                onBarClick={onTopProjectClick}
              />
            </div>
          )}
        </AnalyticsCard>
        <AnalyticsCard
          title="AMIE packet flow"
          rightSlot={
            <Link
              href={amieDeepLinkHref}
              className="text-brand hover:underline"
              data-testid="admin-amie-view-failed"
            >
              View failed →
            </Link>
          }
        >
          {amieFlow.rows.length === 0 || amieFlow.seriesKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No AMIE traffic in this window.</p>
          ) : (
            <div data-testid="admin-amie-flow">
              <StackedAreaUsage
                data={amieFlow.rows}
                seriesKeys={amieFlow.seriesKeys}
                ariaLabel="AMIE packet flow by status"
                onSegmentClick={onAmieSegmentClick}
              />
            </div>
          )}
        </AnalyticsCard>
      </div>

      <AnalyticsCard
        title="Allocation health matrix"
        subtitle="project × resource — band by % used"
      >
        {matrixProjects.length === 0 || matrixResources.length === 0 ? (
          <p className="text-sm text-muted-foreground">No allocations in scope.</p>
        ) : (
          <div data-testid="admin-compliance-matrix">
            <ComplianceMatrix
              rows={matrixProjects}
              cols={matrixResources}
              rowLabel={(p) => p.code}
              colLabel={(r) => r.name}
              cell={matrixCell}
              onCellClick={onMatrixCellClick}
              caption="Allocation health by project and resource"
              cellTooltip={
                matrixApproximate
                  ? () =>
                      "Approximate; based on even split across project's resources."
                  : undefined
              }
            />
            {matrixApproximate ? (
              <p
                className="mt-2 text-xs text-muted-foreground"
                data-testid="admin-compliance-matrix-approximate-caption"
              >
                Approximate per-resource allocation — backend doesn't yet expose
                per-resource budgets, so cells split each project's total
                evenly across used resources.
              </p>
            ) : null}
          </div>
        )}
      </AnalyticsCard>

      <AnalyticsCard
        title="At-risk allocations"
        subtitle="forecast exhaust before award end"
      >
        <DataTable
          columns={atRiskColumns}
          rows={atRisk}
          rowKey={(row) => row.allocationId}
          caption="At-risk allocations"
          onRowClick={(row) =>
            router.push(`/allocations/${row.allocationId}?tab=credits`)
          }
          empty={
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertOctagon className="h-4 w-4" aria-hidden="true" />
              Nothing at risk in this window — good window.
            </div>
          }
        />
      </AnalyticsCard>
    </section>
  );
}
