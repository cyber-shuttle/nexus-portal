"use client";

import Link from "next/link";
import type { ComputeAllocationChangeRequest } from "@shared/api/domain";
import { SideDrawer } from "@/shared/ui/SideDrawer";
import { StatusBadge, statusBadgeVariantFromChangeRequest } from "@/shared/ui/StatusBadge";
import { formatDate, formatSU } from "@/lib/format";
import { useChangeRequestEvents } from "../queries";

export type ChangeRequestDetailDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: ComputeAllocationChangeRequest | null;
};

export function ChangeRequestDetailDrawer({
  open,
  onOpenChange,
  request,
}: ChangeRequestDetailDrawerProps) {
  const { data: events, isLoading } = useChangeRequestEvents(request?.id);

  return (
    <SideDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={request ? `Change request ${request.id}` : "Change request"}
      description={request ? `For allocation ${request.compute_allocation_id}` : undefined}
      width="lg"
    >
      {request ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <StatusBadge
                variant={statusBadgeVariantFromChangeRequest(request.change_status)}
                label={request.change_status}
              />
              <Link
                href={`/allocations/${request.compute_allocation_id}`}
                className="text-sm text-nexus-blue-700 hover:underline"
              >
                View allocation
              </Link>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Requester
                </dt>
                <dd>{request.requester_id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Submitted
                </dt>
                <dd>{formatDate(request.timestamp)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Requested SUs
                </dt>
                <dd>{formatSU(request.requested_su_amount)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  Requested status
                </dt>
                <dd>{request.requested_status}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">Reason</dt>
                <dd className="whitespace-pre-wrap">{request.reason}</dd>
              </div>
              {request.approver_id ? (
                <div className="col-span-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Reviewer
                  </dt>
                  <dd>{request.approver_id}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs uppercase tracking-wide text-muted-foreground">Timeline</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading events…</p>
            ) : !events || events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events recorded.</p>
            ) : (
              <ol className="space-y-2">
                {events.map((e) => (
                  <li key={e.id} className="rounded-md border bg-card p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{e.event_type}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(e.timestamp)}
                      </span>
                    </div>
                    {e.description ? (
                      <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      ) : null}
    </SideDrawer>
  );
}
