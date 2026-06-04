"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { buttonVariants } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import Link from "next/link";
import * as React from "react";
import { useAuditEventsForTrace } from "../queries";
import type { AuditEventsResponse, LinkedEntity, LinkedEntityField, Span, Trace } from "../types";
import { extractLinkedEntities, formatAbsoluteUtc, formatRelative, shortHex } from "../utils";

export type TraceLinkedEntitiesTabProps = {
  trace: Trace;
  spans: Span[];
};

export function TraceLinkedEntitiesTab({ trace, spans }: TraceLinkedEntitiesTabProps) {
  const entities = React.useMemo(() => extractLinkedEntities(spans), [spans]);
  const auditQuery = useAuditEventsForTrace(trace.trace_id);

  return (
    <div className="space-y-6">
      <section aria-labelledby="trace-linked-entities" className="space-y-3">
        <h3 id="trace-linked-entities" className="text-sm font-semibold">
          Entities referenced by this trace
        </h3>
        {entities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No linked entities.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {entities.map((entity, idx) => (
              <LinkedEntityCard key={`${entity.kind}-${entity.primaryId ?? idx}`} entity={entity} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="trace-audit-events" className="space-y-3">
        <h3 id="trace-audit-events" className="text-sm font-semibold">
          Audit events written under this trace
        </h3>
        <AuditEventsBlock
          loading={auditQuery.isLoading}
          error={auditQuery.error}
          data={auditQuery.data}
          onRetry={() => void auditQuery.refetch()}
        />
      </section>
    </div>
  );
}

function LinkedEntityCard({ entity }: { entity: LinkedEntity }) {
  const piiFields = entity.fields.filter((f) => f.pii);
  const visibleFields = entity.fields.filter((f) => !f.pii);
  return (
    <Card size="sm" data-testid={`linked-entity-${entity.kind}`}>
      <CardHeader>
        <CardTitle>{entity.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
          {visibleFields.map((f) => (
            <FieldRow key={f.key} field={f} />
          ))}
        </dl>
        {piiFields.length > 0 ? (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Show contact info
            </summary>
            <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
              {piiFields.map((f) => (
                <FieldRow key={f.key} field={f} />
              ))}
            </dl>
          </details>
        ) : null}
        <CardCta entity={entity} />
      </CardContent>
    </Card>
  );
}

function FieldRow({ field }: { field: LinkedEntityField }) {
  return (
    <>
      <dt className="text-muted-foreground">{field.key}</dt>
      <dd className="font-mono break-all">{field.value}</dd>
    </>
  );
}

function CardCta({ entity }: { entity: LinkedEntity }) {
  if (entity.href && entity.ctaLabel) {
    return (
      <Link href={entity.href} className={buttonVariants({ variant: "outline", size: "xs" })}>
        {entity.ctaLabel}
      </Link>
    );
  }
  // No portal route yet — surface a muted hint so admins know the data is
  // captured but not deep-linkable from this build.
  if (entity.kind === "httpRequest") return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="cursor-help text-xs text-muted-foreground">Route not yet available</span>
        }
      />
      <TooltipContent>No portal page wired for this entity type yet.</TooltipContent>
    </Tooltip>
  );
}

type AuditEventsBlockProps = {
  loading: boolean;
  error: unknown;
  data: AuditEventsResponse | undefined;
  onRetry: () => void;
};

function AuditEventsBlock({ loading, error, data, onRetry }: AuditEventsBlockProps) {
  if (loading) {
    return (
      <div className="space-y-2" data-testid="audit-events-skeleton">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-3/4" />
      </div>
    );
  }
  if (error instanceof Error) {
    return <ErrorState message={error.message} onRetry={onRetry} />;
  }
  const rows = mergeAuditRows(data);
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No audit events written under this trace.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <caption className="sr-only">Audit events under this trace</caption>
        <thead className="bg-muted/30 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Created</th>
            <th className="px-3 py-2 text-left font-medium">Source</th>
            <th className="px-3 py-2 text-left font-medium">Event</th>
            <th className="px-3 py-2 text-left font-medium">Entity ID</th>
            <th className="px-3 py-2 text-left font-medium">Summary</th>
            <th className="px-3 py-2 text-left font-medium">Span</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.source}-${r.id}`} className="border-t border-border/60">
              <td className="px-3 py-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className="cursor-help tabular-nums">
                        {formatRelative(r.createdAt)}
                      </span>
                    }
                  />
                  <TooltipContent>{formatAbsoluteUtc(r.createdAt)}</TooltipContent>
                </Tooltip>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.source}</td>
              <td className="px-3 py-2 font-medium">{r.event}</td>
              <td className="px-3 py-2 font-mono break-all">{r.entityId ?? "—"}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.summary ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-muted-foreground">{shortHex(r.spanId, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type AuditRow = {
  id: string;
  source: "core" | "amie";
  createdAt: string;
  event: string;
  entityId: string | null;
  summary: string | null;
  spanId: string;
};

// Merge both audit streams into one list ordered by created-at desc so the
// most recent rows show up first. `source` column distinguishes the origin.
function mergeAuditRows(data: AuditEventsResponse | undefined): AuditRow[] {
  if (!data) return [];
  const rows: AuditRow[] = [];
  for (const e of data.audit_events) {
    rows.push({
      id: e.id,
      source: "core",
      createdAt: e.event_time,
      event: e.event_type,
      entityId: e.entity_id || null,
      summary: e.details || null,
      spanId: e.span_id,
    });
  }
  for (const e of data.amie_audit_log) {
    rows.push({
      id: String(e.id),
      source: "amie",
      createdAt: e.created_at,
      event: e.action,
      entityId: e.entity_id ?? null,
      summary: e.summary ?? null,
      spanId: e.span_id,
    });
  }
  return rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
