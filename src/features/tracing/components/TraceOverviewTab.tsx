"use client";

import { cn } from "@/lib/utils";
import { MetaItem, MetaRow } from "@/shared/ui/MetaRow";
import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { useAbility } from "@shared/casl/AbilityProvider";
import { CopyIcon } from "lucide-react";
import dynamic from "next/dynamic";
import * as React from "react";
import type { Span, Trace } from "../types";
import { STATUS_TO_BADGE, getTraceStatusInfo } from "../types";
import {
  copyTraceId,
  durationBetween,
  formatAbsoluteUtc,
  formatDurationMs,
  formatRelative,
} from "../utils";

// Lazy-load react-json-view-lite — the stylesheet bundle is ~110 kB and we
// only need it once the user actually opens the Overview tab.
const PayloadJsonView = dynamic(() => import("./PayloadJsonView"), {
  ssr: false,
  loading: () => <div className="h-24 rounded-md border bg-muted/20" />,
});

const PAYLOAD_PREVIEW_CHARS = 1024;

export type TraceOverviewTabProps = {
  trace: Trace;
  spans: Span[];
  onRetry: () => void;
  onSwitchToTab: (tab: "waterfall" | "raw" | "linked", spanId?: string) => void;
};

export function TraceOverviewTab({ trace, spans, onRetry, onSwitchToTab }: TraceOverviewTabProps) {
  const ability = useAbility();
  const retryGate = computeRetryGate(trace, ability.can("retry", "Trace"));
  const statusInfo = getTraceStatusInfo(trace.status);

  const attempts = React.useMemo(() => findRetryAttempts(spans), [spans]);
  const payloadJson = React.useMemo(() => stringifyPayload(trace.root_event), [trace.root_event]);
  const [payloadExpanded, setPayloadExpanded] = React.useState(false);

  const durationMs = durationBetween(trace.started_at, trace.ended_at ?? null);

  return (
    <div className="space-y-5">
      {attempts.length > 0 ? (
        <AttemptsStrip
          attempts={attempts}
          onJump={(spanId) => onSwitchToTab("waterfall", spanId)}
        />
      ) : null}

      <MetaRow>
        <MetaItem
          label="Trace ID"
          value={
            <span className="inline-flex items-center gap-1.5">
              <span className="font-mono text-sm">{trace.trace_id}</span>
              <button
                type="button"
                aria-label={`Copy trace ID ${trace.trace_id}`}
                onClick={() => void copyTraceId(trace.trace_id)}
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CopyIcon className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          }
        />
        <MetaItem label="Source" value={trace.source || "—"} />
        <MetaItem
          variant="default"
          label="Status"
          value={
            <StatusBadge
              variant={STATUS_TO_BADGE[trace.status] ?? "inactive"}
              label={statusInfo.label}
            />
          }
        />
        <MetaItem
          label="Started"
          value={
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="cursor-help tabular-nums">
                    {formatRelative(trace.started_at)}
                  </span>
                }
              />
              <TooltipContent>{formatAbsoluteUtc(trace.started_at)}</TooltipContent>
            </Tooltip>
          }
        />
        <MetaItem
          label="Ended"
          value={
            trace.ended_at ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className="cursor-help tabular-nums">
                      {formatRelative(trace.ended_at)}
                    </span>
                  }
                />
                <TooltipContent>{formatAbsoluteUtc(trace.ended_at)}</TooltipContent>
              </Tooltip>
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
        <MetaItem label="Spans" value={String(spans.length)} />
        <MetaItem
          label="Root operation"
          value={<span className="break-all">{trace.root_name}</span>}
        />
      </MetaRow>

      <section aria-labelledby="trace-root-payload" className="space-y-2">
        <h3 id="trace-root-payload" className="text-sm font-semibold">
          Root payload
        </h3>
        {payloadJson == null ? (
          <p className="text-sm text-muted-foreground">No payload captured for this trace.</p>
        ) : (
          <PayloadPreview
            json={payloadJson}
            expanded={payloadExpanded}
            onToggle={() => setPayloadExpanded((v) => !v)}
          />
        )}
      </section>

      <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
        <RetryButton gate={retryGate} onRetry={onRetry} />
        <Button variant="outline" size="sm" onClick={() => void copyTraceId(trace.trace_id)}>
          Copy trace ID
        </Button>
        <Button variant="outline" size="sm" onClick={() => onSwitchToTab("linked")}>
          View linked entities →
        </Button>
      </div>
    </div>
  );
}

type RetryGate = {
  enabled: boolean;
  reason?: string;
};

function computeRetryGate(trace: Trace, canRetryAbility: boolean): RetryGate {
  if (!canRetryAbility) return { enabled: false, reason: "Only admins can retry" };
  if (trace.status === 0) {
    return { enabled: false, reason: "Cannot retry a successful trace" };
  }
  if (trace.source !== "amie") {
    return {
      enabled: false,
      reason: `Retry is not supported for traces from ${trace.source}`,
    };
  }
  if (trace.root_event == null) {
    return {
      enabled: false,
      reason: "Retry requires the original payload, which was not captured for this trace",
    };
  }
  return { enabled: true };
}

function RetryButton({ gate, onRetry }: { gate: RetryGate; onRetry: () => void }) {
  if (gate.enabled || !gate.reason) {
    return (
      <Button variant="default" size="sm" onClick={onRetry} disabled={!gate.enabled}>
        Retry this flow
      </Button>
    );
  }
  // Disabled native buttons don't fire hover/focus, so the tooltip needs an
  // aria-disabled button that still receives events. `title` mirrors the
  // tooltip text into the DOM as a native fallback for AT and tests.
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="default"
            size="sm"
            aria-disabled
            disabled
            title={gate.reason}
            onClick={(e) => e.preventDefault()}
          >
            Retry this flow
          </Button>
        }
      />
      <TooltipContent>{gate.reason}</TooltipContent>
    </Tooltip>
  );
}

type Attempt = {
  spanId: string;
  attemptNumber: number;
  status: number;
};

// Treat any span named `retry:*` or carrying a `retry.attempt` attribute as a
// retry root. Original root is always Attempt 1; subsequent attempts come from
// the spans in order.
function findRetryAttempts(spans: Span[]): Attempt[] {
  const retries = spans.filter((s) => s.name.startsWith("retry:") || retryAttemptValue(s) != null);
  if (retries.length === 0) return [];
  const original = spans.find((s) => !s.parent_span_id);
  const result: Attempt[] = [];
  if (original) {
    result.push({ spanId: original.span_id, attemptNumber: 1, status: original.status });
  }
  let implicitCounter = 0;
  for (const r of retries) {
    const explicit = retryAttemptValue(r);
    implicitCounter += 1;
    result.push({
      spanId: r.span_id,
      // retry.attempt is the retry counter; +1 gives the user-visible attempt index
      attemptNumber: explicit != null ? explicit + 1 : implicitCounter + 1,
      status: r.status,
    });
  }
  return result.sort((a, b) => a.attemptNumber - b.attemptNumber);
}

function retryAttemptValue(span: Span): number | null {
  const attrs = span.attributes;
  if (!attrs || typeof attrs !== "object") return null;
  const raw = (attrs as Record<string, unknown>)["retry.attempt"];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function AttemptsStrip({
  attempts,
  onJump,
}: {
  attempts: Attempt[];
  onJump: (spanId: string) => void;
}) {
  return (
    <ol aria-label="Retry attempts" className="flex flex-wrap items-center gap-2 text-xs">
      {attempts.map((a) => {
        const tone =
          a.status === 0
            ? "border-[color:var(--nexus-green-200)] bg-[color:var(--nexus-green-50)] text-[color:var(--nexus-green-700)]"
            : a.status === 1
              ? "border-[color:var(--nexus-red-200)] bg-[color:var(--nexus-red-50)] text-[color:var(--nexus-red-700)]"
              : "border-border bg-muted/30 text-muted-foreground";
        const glyph = a.status === 0 ? "✓" : a.status === 1 ? "✗" : "↻";
        return (
          <li key={a.spanId}>
            <button
              type="button"
              onClick={() => onJump(a.spanId)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-medium",
                tone,
                "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span>Attempt {a.attemptNumber}</span>
              <span aria-hidden="true">{glyph}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function PayloadPreview({
  json,
  expanded,
  onToggle,
}: {
  json: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tooLong = json.length > PAYLOAD_PREVIEW_CHARS;
  if (expanded || !tooLong) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      parsed = null;
    }
    if (parsed == null || typeof parsed !== "object") {
      return (
        <pre className="overflow-x-auto rounded-md border bg-muted/20 p-3 text-xs">{json}</pre>
      );
    }
    return (
      <div className="space-y-2">
        <PayloadJsonView data={parsed} />
        {tooLong ? (
          <Button variant="ghost" size="xs" onClick={onToggle}>
            Show less
          </Button>
        ) : null}
      </div>
    );
  }
  const preview = `${json.slice(0, PAYLOAD_PREVIEW_CHARS)}…`;
  return (
    <div className="space-y-2">
      <pre className="overflow-x-auto rounded-md border bg-muted/20 p-3 text-xs">{preview}</pre>
      <Button variant="ghost" size="xs" onClick={onToggle}>
        Show more
      </Button>
    </div>
  );
}

function stringifyPayload(payload: unknown): string | null {
  if (payload == null) return null;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return null;
  }
}
