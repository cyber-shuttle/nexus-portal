import { EmptyState } from "@/shared/ui/EmptyState";
import type { AuditEvent } from "@shared/api/audit-orchestrator";

function describe(event: AuditEvent): string {
  if (event.kind === "diff") {
    return `Allocation diff · ${event.data.diff_type}`;
  }
  if (event.kind === "change_request") {
    return `Change request · ${event.data.change_status}`;
  }
  return `Change-request event · ${event.data.event_type}`;
}

function detail(event: AuditEvent): string | undefined {
  if (event.kind === "diff") return event.data.description;
  if (event.kind === "change_request") return event.data.reason;
  return event.data.description;
}

export type RecentActivityFeedProps = {
  events: AuditEvent[];
  heading?: string;
  emptyMessage?: string;
};

export function RecentActivityFeed({
  events,
  heading = "Recent activity",
  emptyMessage = "No activity in the last 30 days.",
}: RecentActivityFeedProps) {
  return (
    <section className="rounded-lg border bg-card">
      <header className="border-b px-5 py-3">
        <h2 className="font-heading text-base font-semibold">{heading}</h2>
      </header>
      {events.length === 0 ? (
        <div className="p-5">
          <EmptyState heading="Nothing new yet" description={emptyMessage} />
        </div>
      ) : (
        <ol className="divide-y">
          {events.map((event, i) => (
            <li
              key={`${event.kind}-${
                event.kind === "diff"
                  ? event.data.id
                  : event.kind === "change_request"
                    ? event.data.id
                    : event.data.id
              }-${i}`}
              className="flex items-start justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{describe(event)}</p>
                {detail(event) ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail(event)}</p>
                ) : null}
              </div>
              <time
                dateTime={event.timestamp}
                className="shrink-0 text-xs text-muted-foreground tabular-nums"
              >
                {new Date(event.timestamp).toLocaleDateString()}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
