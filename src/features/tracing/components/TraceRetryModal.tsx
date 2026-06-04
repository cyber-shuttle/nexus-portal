"use client";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Loader2Icon } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { RetryApiError } from "../api";
import { useLastTraceId, useRetryTrace } from "../queries";
import type { Span, Trace } from "../types";

// Lazy-load react-json-view-lite — same rationale as Phase 3's Overview tab.
const PayloadJsonView = dynamic(() => import("./PayloadJsonView"), {
  ssr: false,
  loading: () => <div className="h-24 rounded-md border bg-muted/20" />,
});

const PAYLOAD_PREVIEW_CHARS = 1024;

export type TraceRetryModalProps = {
  trace: Trace;
  spans: Span[];
  open: boolean;
  onClose: () => void;
};

export function TraceRetryModal({ trace, spans, open, onClose }: TraceRetryModalProps) {
  const retry = useRetryTrace();
  const lastTraceId = useLastTraceId();
  const router = useRouter();
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const attemptCount = React.useMemo(() => countRetryAttempts(spans) + 1, [spans]);
  const failedPriorAttempts = Math.max(0, attemptCount - 1);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [payloadExpanded, setPayloadExpanded] = React.useState(false);
  const payloadJson = React.useMemo(() => stringifyPayload(trace.root_event), [trace.root_event]);

  // Reset transient state whenever the modal reopens so a previous failure
  // doesn't bleed into a fresh confirmation.
  React.useEffect(() => {
    if (open) {
      setLastError(null);
      setPayloadExpanded(false);
    }
  }, [open]);

  const handleConfirmRef = React.useRef<() => void>(() => {});
  const handleConfirm = React.useCallback(() => {
    setLastError(null);
    retry.mutate(trace.trace_id, {
      onSuccess: () => {
        // X-Trace-Id from the retry response surfaces a deep-link in the toast.
        const linkTraceId = lastTraceId ?? trace.trace_id;
        toast.success(
          "Retry queued — trace will reappear with a new root span. Audit entry created.",
          {
            action: {
              label: "View trace →",
              onClick: () => {
                router.push(`/admin/traces/${encodeURIComponent(linkTraceId)}`);
              },
            },
          },
        );
        onClose();
      },
      onError: (error) => {
        const { message, status } = describeRetryError(error, trace.source);
        setLastError(message);
        if (status >= 500) {
          toast.error("Retry failed — backend error. See logs.", {
            action: {
              // Re-invoke the full handler so a second failure also surfaces a toast.
              label: "Retry the retry",
              onClick: () => handleConfirmRef.current(),
            },
          });
        } else {
          toast.error(message);
        }
      },
    });
  }, [retry, trace.trace_id, trace.source, lastTraceId, onClose, router]);
  React.useEffect(() => {
    handleConfirmRef.current = handleConfirm;
  }, [handleConfirm]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !retry.isPending) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        // Cancel is default-focused (spec §10 risk #3): make sure the
        // initialFocus lands on it even when base-ui auto-focuses content.
        initialFocus={cancelRef}
      >
        <DialogHeader>
          <DialogTitle>Retry this flow?</DialogTitle>
          <DialogDescription>
            Operation <span className="font-mono">{trace.root_name}</span> · source {trace.source} ·
            Attempt {attemptCount}
            {failedPriorAttempts > 0
              ? ` (${failedPriorAttempts} previous ${failedPriorAttempts === 1 ? "attempt" : "attempts"} failed)`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          The flow will be re-executed under the same trace ID. Existing data is not deleted.
          Idempotent operations will be safely skipped.
        </p>
        <section aria-labelledby="trace-retry-payload" className="space-y-2">
          <h3
            id="trace-retry-payload"
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            Original payload
          </h3>
          {payloadJson == null ? (
            <p className="text-sm text-muted-foreground">No payload captured for this trace.</p>
          ) : (
            <PayloadPreview
              json={payloadJson}
              payload={trace.root_event}
              expanded={payloadExpanded}
              onToggle={() => setPayloadExpanded((v) => !v)}
            />
          )}
        </section>
        {lastError ? (
          <p
            role="alert"
            className="rounded-md border border-[color:var(--nexus-red-200)] bg-[color:var(--nexus-red-50)] p-2 text-xs text-[color:var(--nexus-red-700)]"
          >
            Last attempt failed: {lastError}
          </p>
        ) : null}
        <DialogFooter>
          <Button ref={cancelRef} variant="ghost" onClick={onClose} disabled={retry.isPending}>
            Cancel
          </Button>
          <Button
            // Soft-red destructive variant per spec §10 risk #3.
            variant="destructive"
            onClick={handleConfirm}
            disabled={retry.isPending}
          >
            {retry.isPending ? (
              <>
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden="true" />
                <span>Retrying…</span>
              </>
            ) : (
              "Retry this flow"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function describeRetryError(error: unknown, source: string): { message: string; status: number } {
  if (error instanceof RetryApiError) {
    return {
      message: error.body.error || messageForStatus(error.status, source),
      status: error.status,
    };
  }
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    return { message: messageForStatus(status, source), status };
  }
  return { message: "Retry failed.", status: 500 };
}

function messageForStatus(status: number, source: string): string {
  if (status === 400) return "Invalid trace ID.";
  if (status === 404) return "Trace no longer exists.";
  if (status === 409)
    return `Retry is not supported for traces from ${source}. Contact the developer who owns it.`;
  if (status === 410)
    return "The original packet for this trace has been purged and cannot be retried.";
  if (status === 422)
    return "This trace was recorded before payload capture was active; cannot retry. Re-run the original flow manually.";
  if (status >= 500) return "Retry failed — backend error.";
  return "Retry failed.";
}

function countRetryAttempts(spans: Span[]): number {
  let n = 0;
  for (const s of spans) {
    if (s.name.startsWith("retry:")) {
      n += 1;
      continue;
    }
    const attrs = s.attributes;
    if (
      attrs &&
      typeof attrs === "object" &&
      (attrs as Record<string, unknown>)["retry.attempt"] != null
    ) {
      n += 1;
    }
  }
  return n;
}

function stringifyPayload(payload: unknown): string | null {
  if (payload == null) return null;
  try {
    return JSON.stringify(payload, null, 2);
  } catch {
    return null;
  }
}

function PayloadPreview({
  json,
  payload,
  expanded,
  onToggle,
}: {
  json: string;
  payload: unknown;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tooLong = json.length > PAYLOAD_PREVIEW_CHARS;
  if (expanded || !tooLong) {
    if (payload == null || typeof payload !== "object") {
      return (
        <pre className="max-h-48 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
          {json}
        </pre>
      );
    }
    return (
      <div className="space-y-2">
        <div className="max-h-48 overflow-auto">
          <PayloadJsonView data={payload} />
        </div>
        {tooLong ? (
          <Button variant="ghost" size="xs" onClick={onToggle}>
            Show less
          </Button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <pre className="max-h-48 overflow-auto rounded-md border bg-muted/20 p-3 text-xs">
        {`${json.slice(0, PAYLOAD_PREVIEW_CHARS)}…`}
      </pre>
      <Button variant="ghost" size="xs" onClick={onToggle}>
        Show more
      </Button>
    </div>
  );
}
