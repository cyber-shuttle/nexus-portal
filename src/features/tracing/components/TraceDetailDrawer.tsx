"use client";

import { cn } from "@/lib/utils";
import { ErrorState } from "@/shared/ui/ErrorState";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { TabsRouter } from "@/shared/ui/TabsRouter";
import { Skeleton } from "@/shared/ui/skeleton";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { useTrace } from "../queries";
import type { Trace } from "../types";
import { STATUS_TO_BADGE, getTraceStatusInfo } from "../types";
import { formatAbsoluteUtc, shortHex } from "../utils";
import { TraceLinkedEntitiesTab } from "./TraceLinkedEntitiesTab";
import { TraceOverviewTab } from "./TraceOverviewTab";
import { TraceRawJsonTab } from "./TraceRawJsonTab";
import { TraceRetryModal } from "./TraceRetryModal";
import { TraceWaterfallTab } from "./TraceWaterfallTab";

export type TraceDetailDrawerProps = {
  traceId: string | null;
  open: boolean;
  onClose: () => void;
};

export function TraceDetailDrawer({ traceId, open, onClose }: TraceDetailDrawerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data, isLoading, error, refetch } = useTrace(open && traceId ? traceId : undefined);

  // Switch tabs by updating the URL `tab` search-param so the active tab
  // survives a refresh. When jumping from the Overview attempts strip, an
  // optional spanId pre-selects + scrolls the matching waterfall row.
  const switchToTab = React.useCallback(
    (tab: "waterfall" | "raw" | "linked", spanId?: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", tab);
      if (spanId) params.set("span", spanId);
      // ?span= only makes sense in the waterfall; drop it elsewhere so a
      // tab round-trip doesn't smuggle a stale selection back in.
      else if (tab !== "waterfall") params.delete("span");
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [retryOpen, setRetryOpen] = React.useState(false);
  const onRetry = React.useCallback(() => setRetryOpen(true), []);

  const trace = data?.trace;
  const spans = data?.spans ?? [];

  return (
    <SideDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      width="lg"
      title={
        trace ? (
          <DrawerHeaderTitle trace={trace} />
        ) : traceId ? (
          <span className="font-mono text-sm">Trace · {shortHex(traceId, 12)}…</span>
        ) : (
          "Trace"
        )
      }
      description={trace ? trace.root_name : undefined}
    >
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : !trace ? (
        <p className="text-sm text-muted-foreground">Trace not found.</p>
      ) : (
        <div className="space-y-5">
          <StatusBreadcrumb trace={trace} />
          <TabsRouter
            defaultValue="overview"
            searchParam="tab"
            tabs={[
              {
                value: "overview",
                label: "Overview",
                content: (
                  <TraceOverviewTab
                    trace={trace}
                    spans={spans}
                    onRetry={onRetry}
                    onSwitchToTab={switchToTab}
                  />
                ),
              },
              {
                value: "waterfall",
                label: "Waterfall",
                content: (
                  <TraceWaterfallTab
                    spans={spans}
                    rootStart={trace.started_at}
                    rootEnd={trace.ended_at}
                    scrollToSpanId={searchParams.get("span") ?? undefined}
                  />
                ),
              },
              {
                value: "raw",
                label: "Raw JSON",
                content: <TraceRawJsonTab trace={trace} spans={spans} />,
              },
              {
                value: "linked",
                label: "Linked",
                content: <TraceLinkedEntitiesTab trace={trace} spans={spans} />,
              },
            ]}
          />
          <TraceRetryModal
            trace={trace}
            spans={spans}
            open={retryOpen}
            onClose={() => setRetryOpen(false)}
          />
        </div>
      )}
    </SideDrawer>
  );
}

function DrawerHeaderTitle({ trace }: { trace: Trace }) {
  const info = getTraceStatusInfo(trace.status);
  return (
    <span className="flex items-center gap-2">
      <span>Trace · </span>
      <span className="font-mono text-sm">{shortHex(trace.trace_id, 12)}…</span>
      <StatusBadge variant={STATUS_TO_BADGE[trace.status] ?? "inactive"} label={info.label} />
    </span>
  );
}

type CrumbStep = {
  key: string;
  label: string;
  state: "reached" | "current" | "pending";
  at?: string;
};

function StatusBreadcrumb({ trace }: { trace: Trace }) {
  const steps = computeStatusSteps(trace);
  return (
    <ol aria-label="Trace lifecycle" className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <li
            className={cn(
              "rounded-md border px-2 py-1",
              step.state === "current"
                ? "border-[color:var(--nexus-blue-200)] bg-[color:var(--nexus-blue-50)] text-[color:var(--nexus-blue-700)]"
                : step.state === "reached"
                  ? "border-border bg-card text-foreground"
                  : "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            <span className="font-medium">{step.label}</span>
            {step.at ? (
              <time className="ml-2 tabular-nums text-muted-foreground" dateTime={step.at}>
                {formatAbsoluteUtc(step.at)}
              </time>
            ) : null}
          </li>
          {i < steps.length - 1 ? <span aria-hidden="true">→</span> : null}
        </React.Fragment>
      ))}
    </ol>
  );
}

function computeStatusSteps(trace: Trace): CrumbStep[] {
  const ended = trace.ended_at ?? undefined;
  const inProgress = !ended;
  const terminalLabel = getTraceStatusInfo(trace.status).label.toUpperCase();
  return [
    { key: "started", label: "STARTED", state: "reached", at: trace.started_at },
    inProgress
      ? { key: "current", label: "IN PROGRESS", state: "current" }
      : { key: "terminal", label: terminalLabel, state: "reached", at: ended },
  ];
}
