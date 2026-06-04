"use client";

import { DrillStack } from "@/shared/ui/DrillStack";
import { MetaItem, MetaRow } from "@/shared/ui/MetaRow";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { CopyIcon } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import type { Span } from "../types";
import { STATUS_TO_BADGE, getSpanKindLabel, getTraceStatusInfo } from "../types";
import {
  copyTraceId,
  durationBetween,
  formatAbsoluteUtc,
  formatDurationMs,
  formatRelative,
} from "../utils";

const PayloadJsonView = dynamic(() => import("./PayloadJsonView"), {
  ssr: false,
  loading: () => <div className="h-24 rounded-md border bg-muted/20" />,
});

export type TraceSpanDetailPanelProps = {
  span: Span | null;
  rootStart: string;
  open: boolean;
  onClose: () => void;
};

export function TraceSpanDetailPanel({ span, open, onClose }: TraceSpanDetailPanelProps) {
  return (
    <DrillStack
      open={open}
      onClose={onClose}
      title={span ? span.name : "Span"}
      crumbs={[{ label: "Trace", onPop: onClose }]}
      width="lg"
    >
      {span ? <SpanDetailBody span={span} /> : null}
    </DrillStack>
  );
}

function SpanDetailBody({ span }: { span: Span }) {
  const statusInfo = getTraceStatusInfo(span.status);
  const durationMs = durationBetween(span.start_time, span.end_time ?? null);
  const attrs = span.attributes;
  const attrsIsObject = attrs != null && typeof attrs === "object";

  return (
    <div className="space-y-5">
      <MetaRow>
        <MetaItem
          label="Span ID"
          value={
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-sm">{span.span_id}</span>
              <button
                type="button"
                aria-label={`Copy span ID ${span.span_id}`}
                onClick={() => void copyTraceId(span.span_id)}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CopyIcon className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          }
        />
        <MetaItem
          label="Parent span"
          value={
            span.parent_span_id ? (
              <span className="font-mono text-sm">{span.parent_span_id}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          }
        />
        <MetaItem label="Name" value={<span className="break-all">{span.name}</span>} />
        <MetaItem label="Kind" value={getSpanKindLabel(span.kind)} />
        <MetaItem
          label="Status"
          value={
            <StatusBadge
              variant={STATUS_TO_BADGE[span.status] ?? "inactive"}
              label={statusInfo.label}
            />
          }
        />
        <MetaItem
          label="Started"
          value={
            <span className="tabular-nums">
              {formatRelative(span.start_time)}{" "}
              <span className="text-muted-foreground">({formatAbsoluteUtc(span.start_time)})</span>
            </span>
          }
        />
        <MetaItem
          label="Ended"
          value={
            span.end_time ? (
              <span className="tabular-nums">
                {formatRelative(span.end_time)}{" "}
                <span className="text-muted-foreground">({formatAbsoluteUtc(span.end_time)})</span>
              </span>
            ) : (
              <span className="text-muted-foreground">In progress</span>
            )
          }
        />
        <MetaItem
          label="Duration"
          value={
            <span className="tabular-nums">
              {durationMs == null ? "—" : formatDurationMs(durationMs)}
            </span>
          }
        />
      </MetaRow>

      {span.status_message ? (
        <section aria-labelledby="span-status-message" className="space-y-2">
          <h3 id="span-status-message" className="text-sm font-semibold">
            Status message
          </h3>
          <p className="rounded-md border border-[color:var(--nexus-red-200)] bg-[color:var(--nexus-red-50)] px-3 py-2 text-xs text-[color:var(--nexus-red-700)]">
            {span.status_message}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="span-attributes" className="space-y-2">
        <h3 id="span-attributes" className="text-sm font-semibold">
          Attributes
        </h3>
        {attrsIsObject ? (
          <PayloadJsonView data={attrs as object} />
        ) : (
          <p className="text-sm text-muted-foreground">(no attributes)</p>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button variant="outline" size="sm" onClick={() => void copyTraceId(span.span_id)}>
          Copy span ID
        </Button>
      </div>
    </div>
  );
}
