"use client";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import type { AuditEvent } from "@shared/api/audit-orchestrator";
import { ClipboardListIcon, PencilIcon, TriangleAlertIcon, UsersIcon } from "lucide-react";
import * as React from "react";

type RangeOption = "all" | "7d" | "30d" | "90d";

type FilterTypes = {
  diff: boolean;
  change_request: boolean;
  change_request_event: boolean;
};

function eventTimestamp(event: AuditEvent): number {
  return new Date(event.timestamp).getTime();
}

function eventTitle(event: AuditEvent): string {
  if (event.kind === "diff") {
    return `Allocation diff · ${event.data.diff_type}`;
  }
  if (event.kind === "change_request") {
    return `Change request · ${event.data.change_status}`;
  }
  return `Change-request event · ${event.data.event_type}`;
}

function eventSummary(event: AuditEvent): string | undefined {
  if (event.kind === "diff") return event.data.description;
  if (event.kind === "change_request") return event.data.reason;
  return event.data.description;
}

function eventActor(event: AuditEvent): string | null {
  if (event.kind === "change_request") {
    return `requester ${event.data.requester_id}`;
  }
  if (event.kind === "change_request_event") {
    return null;
  }
  return null;
}

function eventIcon(event: AuditEvent) {
  const className = "size-4";
  if (event.kind === "diff") {
    return (
      <PencilIcon className={cn(className, "text-[color:var(--nexus-blue-600)]")} aria-hidden />
    );
  }
  if (event.kind === "change_request") {
    return (
      <ClipboardListIcon
        className={cn(className, "text-[color:var(--nexus-blue-600)]")}
        aria-hidden
      />
    );
  }
  return <UsersIcon className={cn(className, "text-[color:var(--nexus-gray-600)]")} aria-hidden />;
}

export type AuditTabProps = {
  events: AuditEvent[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
};

export function AuditTab({ events, isLoading, error, onRetry }: AuditTabProps) {
  const [types, setTypes] = React.useState<FilterTypes>({
    diff: true,
    change_request: true,
    change_request_event: true,
  });
  const [actor, setActor] = React.useState("");
  const [range, setRange] = React.useState<RangeOption>("all");

  const filtered = events.filter((event) => {
    if (!types[event.kind]) return false;
    if (actor) {
      const summary = `${eventActor(event) ?? ""} ${JSON.stringify(event.data)}`.toLowerCase();
      if (!summary.includes(actor.toLowerCase())) return false;
    }
    if (range !== "all") {
      const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      if (eventTimestamp(event) < cutoff) return false;
    }
    return true;
  });

  if (isLoading) return <CenteredSpinner label="Loading audit log" />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-4">
        <fieldset className="flex flex-wrap items-center gap-2 border-0 p-0">
          <legend className="mr-2 text-xs uppercase tracking-wide text-muted-foreground">
            Type
          </legend>
          {(["diff", "change_request", "change_request_event"] as const).map((kind) => (
            <label key={kind} className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={types[kind]}
                onChange={(e) => setTypes((prev) => ({ ...prev, [kind]: e.target.checked }))}
              />
              {kind.replace(/_/g, " ")}
            </label>
          ))}
        </fieldset>
        <input
          type="search"
          placeholder="Filter by actor or text"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          aria-label="Filter audit log by actor"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        />
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeOption)}
          aria-label="Filter audit log by date range"
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="all">All time</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<TriangleAlertIcon className="size-6" aria-hidden />}
          heading="No audit events yet"
          description="Allocation diffs and change-request events will appear here."
        />
      ) : (
        <ol className="relative space-y-4 border-l border-border/60 pl-6">
          {filtered.map((event, i) => (
            <li
              key={`${event.kind}-${
                event.kind === "diff"
                  ? event.data.id
                  : event.kind === "change_request"
                    ? event.data.id
                    : event.data.id
              }-${i}`}
              className="relative"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[37px] top-0.5 flex size-6 items-center justify-center rounded-full border bg-background"
              >
                {eventIcon(event)}
              </span>
              <div className="rounded-md border bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="font-heading text-sm font-semibold">{eventTitle(event)}</h4>
                  <time
                    dateTime={event.timestamp}
                    className="text-xs text-muted-foreground tabular-nums"
                  >
                    {new Date(event.timestamp).toLocaleString()}
                  </time>
                </div>
                {eventActor(event) ? (
                  <p className="mt-1 text-xs text-muted-foreground">{eventActor(event)}</p>
                ) : null}
                {eventSummary(event) ? (
                  <p className="mt-2 text-sm text-foreground">{eventSummary(event)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
