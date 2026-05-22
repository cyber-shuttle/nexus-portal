"use client";

import Link from "next/link";
import * as React from "react";
import { JsonView, defaultStyles } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { cn } from "@/lib/utils";
import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { Button } from "@/shared/ui/button";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { Packet, PacketEvent } from "../types";
import { PacketStatusBadge } from "./PacketStatusBadge";

function ageHoursOf(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 3600_000;
}

function formatDate(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function entityHref(type: string, id: string): string | null {
  if (type === "project") return `/allocations?project=${encodeURIComponent(id)}`;
  return null;
}

export type PacketDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packet: Packet | undefined;
  events: PacketEvent[];
  isLoading: boolean;
  eventsLoading: boolean;
  error: Error | null;
  canRetry: boolean;
  canResolve: boolean;
  onRetry: () => void;
  onResolve: (reason: string) => void;
  onRefresh: () => void;
};

const TAB_VALUES = ["overview", "raw", "timeline", "linked"] as const;
type TabValue = (typeof TAB_VALUES)[number];

const STATE_BREADCRUMB: Array<{
  key: string;
  label: string;
  whenAt: (p: Packet) => string | undefined;
}> = [
  { key: "received", label: "NEW", whenAt: (p) => p.received_at },
  { key: "decoded", label: "DECODED", whenAt: (p) => p.decoded_at },
  {
    key: "terminal",
    label: "PROCESSED | FAILED",
    whenAt: (p) =>
      p.status === "PROCESSED" ? p.processed_at : p.status === "FAILED" ? p.updated_at : undefined,
  },
];

function StateMachineBreadcrumb({ packet }: { packet: Packet }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label="State machine">
      {STATE_BREADCRUMB.map((step, i) => {
        const at = step.whenAt(packet);
        const reached = Boolean(at);
        return (
          <React.Fragment key={step.key}>
            <li
              className={cn(
                "rounded-md border px-2 py-1",
                reached
                  ? "border-[color:var(--nexus-blue-200)] bg-[color:var(--nexus-blue-50)]"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
            >
              <span className="font-medium">{step.label}</span>
              {reached ? (
                <time className="ml-2 tabular-nums text-muted-foreground" dateTime={at}>
                  {formatDate(at)}
                </time>
              ) : null}
            </li>
            {i < STATE_BREADCRUMB.length - 1 ? <span aria-hidden="true">→</span> : null}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function OverviewTab({ packet }: { packet: Packet }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PacketStatusBadge status={packet.status} ageHours={ageHoursOf(packet.received_at)} />
        <span className="font-mono text-sm">{packet.amie_id}</span>
        <span className="text-xs text-muted-foreground">{packet.type}</span>
      </div>
      <StateMachineBreadcrumb packet={packet} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Source</dt>
        <dd>{packet.source}</dd>
        <dt className="text-muted-foreground">Retries</dt>
        <dd>{packet.retries}</dd>
        <dt className="text-muted-foreground">Received</dt>
        <dd className="tabular-nums">{formatDate(packet.received_at)}</dd>
        <dt className="text-muted-foreground">Decoded</dt>
        <dd className="tabular-nums">{formatDate(packet.decoded_at)}</dd>
        <dt className="text-muted-foreground">Processed</dt>
        <dd className="tabular-nums">{formatDate(packet.processed_at)}</dd>
        <dt className="text-muted-foreground">Updated</dt>
        <dd className="tabular-nums">{formatDate(packet.updated_at)}</dd>
      </dl>
      {packet.last_error ? (
        <div className="rounded-md border border-[color:var(--nexus-red-200)] bg-[color:var(--nexus-red-50)] p-3 text-sm text-[color:var(--nexus-red-700)]">
          <strong>Last error:</strong> {packet.last_error}
        </div>
      ) : null}
      {packet.decoded_payload ? (
        <section aria-labelledby="amie-decoded-heading" className="space-y-2">
          <h3 id="amie-decoded-heading" className="text-sm font-semibold">
            Decoded payload
          </h3>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/20 p-3 text-xs">
            {Object.entries(packet.decoded_payload).map(([key, value]) => (
              <React.Fragment key={key}>
                <dt className="text-muted-foreground">{key}</dt>
                <dd className="break-all">
                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function RawJsonTab({ packet }: { packet: Packet }) {
  if (!packet.raw_json) {
    return <p className="text-sm text-muted-foreground">No raw payload available.</p>;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(packet.raw_json);
  } catch {
    return (
      <pre className="overflow-x-auto rounded-md border bg-muted/20 p-3 text-xs">
        {packet.raw_json}
      </pre>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border bg-background p-3 text-xs">
      <JsonView data={parsed as object} style={defaultStyles} />
    </div>
  );
}

function eventIconLabel(event: PacketEvent): string {
  switch (event.event_type) {
    case "RECEIVED":
      return "[●]";
    case "DECODED":
      return "[◇]";
    case "HANDLED":
      return "[✓]";
    case "FAILED":
      return "[!]";
    case "RETRY":
    case "RETRY_SCHEDULED":
      return "[↻]";
    case "MANUAL_RESOLVE":
    case "MANUAL_LINK":
      return "[★]";
    default:
      return "[•]";
  }
}

function TimelineTab({ events, isLoading }: { events: PacketEvent[]; isLoading: boolean }) {
  if (isLoading) return <CenteredSpinner label="Loading timeline" />;
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">No events recorded.</p>;
  }
  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex items-start gap-3 rounded-md border bg-card p-3 text-sm">
          <span aria-hidden="true" className="font-mono text-xs text-muted-foreground">
            {eventIconLabel(event)}
          </span>
          <div className="flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{event.event_type}</span>
              <time
                dateTime={event.timestamp}
                className="text-xs tabular-nums text-muted-foreground"
              >
                {formatDate(event.timestamp)}
              </time>
            </div>
            <p className="text-xs text-muted-foreground">
              {event.actor} · {event.status}
              {event.duration_ms !== undefined ? ` · ${event.duration_ms}ms` : null}
            </p>
            {event.message ? <p className="mt-1 text-sm">{event.message}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function LinkedEntityTab({ packet }: { packet: Packet }) {
  if (!packet.linked_entity) {
    return (
      <p className="text-sm text-muted-foreground">
        This packet is not yet linked to a domain entity. Use the reconciliation queue to link it
        manually.
      </p>
    );
  }
  const href = entityHref(packet.linked_entity.type, packet.linked_entity.id);
  return (
    <div className="space-y-2 text-sm">
      <p className="text-muted-foreground">Linked entity</p>
      <p>
        <span className="font-medium">{packet.linked_entity.type}</span> ·{" "}
        <span className="font-mono">
          {packet.linked_entity.display_id ?? packet.linked_entity.id}
        </span>
      </p>
      {href ? (
        <Link href={href} className="text-[color:var(--nexus-blue-700)] hover:underline">
          View in portal →
        </Link>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Reverse link from the entity back to this packet ships in Phase 7.
      </p>
    </div>
  );
}

export function PacketDetailDrawer({
  open,
  onOpenChange,
  packet,
  events,
  isLoading,
  eventsLoading,
  error,
  canRetry,
  canResolve,
  onRetry,
  onResolve,
  onRefresh,
}: PacketDetailDrawerProps) {
  const [tab, setTab] = React.useState<TabValue>("overview");
  const [resolveOpen, setResolveOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      setTab("overview");
      setResolveOpen(false);
      setReason("");
    }
  }, [open]);

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title={packet ? `Packet ${packet.amie_id}` : "Packet"}
      description={packet ? `${packet.type} · ${packet.id}` : undefined}
    >
      {isLoading ? (
        <CenteredSpinner label="Loading packet" />
      ) : error ? (
        <ErrorState message={error.message ?? "Failed to load packet"} onRetry={onRefresh} />
      ) : !packet ? (
        <p className="text-sm text-muted-foreground">Packet not found.</p>
      ) : (
        <div className="space-y-5">
          <TabsPrimitive.Root
            value={tab}
            onValueChange={(v) => typeof v === "string" && setTab(v as TabValue)}
          >
            <TabsPrimitive.List className="flex gap-1 border-b border-border/80">
              {[
                { value: "overview", label: "Overview" },
                { value: "raw", label: "Raw JSON" },
                { value: "timeline", label: "Timeline" },
                { value: "linked", label: "Linked entity" },
              ].map((t) => (
                <TabsPrimitive.Tab
                  key={t.value}
                  value={t.value}
                  className={cn(
                    "relative -mb-px inline-flex items-center justify-center rounded-t-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
                    "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "data-selected:border-b-2 data-selected:border-[color:var(--nexus-blue-500)] data-selected:text-foreground",
                  )}
                >
                  {t.label}
                </TabsPrimitive.Tab>
              ))}
            </TabsPrimitive.List>
            <TabsPrimitive.Panel value="overview" className="pt-4">
              <OverviewTab packet={packet} />
            </TabsPrimitive.Panel>
            <TabsPrimitive.Panel value="raw" className="pt-4">
              <RawJsonTab packet={packet} />
            </TabsPrimitive.Panel>
            <TabsPrimitive.Panel value="timeline" className="pt-4">
              <TimelineTab events={events} isLoading={eventsLoading} />
            </TabsPrimitive.Panel>
            <TabsPrimitive.Panel value="linked" className="pt-4">
              <LinkedEntityTab packet={packet} />
            </TabsPrimitive.Panel>
          </TabsPrimitive.Root>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
            {canRetry ? (
              <Button variant="outline" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
            {canResolve ? (
              resolveOpen ? (
                <form
                  className="flex flex-1 items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (reason.trim().length < 3) return;
                    onResolve(reason);
                    setResolveOpen(false);
                    setReason("");
                  }}
                >
                  <label className="flex flex-1 flex-col gap-1 text-xs">
                    <span className="text-muted-foreground">Resolution reason</span>
                    <input
                      className="rounded-md border bg-background px-3 py-1.5 text-sm"
                      placeholder="Manual resolution — what was done?"
                      value={reason}
                      onChange={(e) => setReason(e.currentTarget.value)}
                      required
                      minLength={3}
                    />
                  </label>
                  <Button type="submit" disabled={reason.trim().length < 3}>
                    Confirm resolve
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setResolveOpen(false)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <Button variant="destructive" onClick={() => setResolveOpen(true)}>
                  Resolve manually
                </Button>
              )
            ) : null}
          </div>
        </div>
      )}
    </SideDrawer>
  );
}
