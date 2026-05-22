"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { StatusBadge, type StatusBadgeVariant } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  useApproveProposal,
  useDenyProposal,
  useProposal,
  useWithdrawProposal,
} from "@features/proposals/queries";
import type { ProposalStatus } from "@features/proposals/types";
import { ApiError } from "@shared/api/client";
import { useAbility } from "@shared/casl/AbilityProvider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

function statusVariant(status: ProposalStatus): StatusBadgeVariant {
  if (status === "APPROVED") return "approved";
  if (status === "DENIED" || status === "WITHDRAWN") return "rejected";
  if (status === "UNDER_REVIEW") return "warning";
  if (status === "SUBMITTED") return "pending";
  if (status === "DRAFT") return "inactive";
  return "pending";
}

type DecisionDialog = { kind: "approve" | "deny"; note: string } | null;

export function ProposalDetailContainer({ proposalId }: { proposalId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const ability = useAbility();
  const proposalQuery = useProposal(proposalId);
  const approveMutation = useApproveProposal();
  const denyMutation = useDenyProposal();
  const withdrawMutation = useWithdrawProposal();
  const [decision, setDecision] = React.useState<DecisionDialog>(null);

  if (proposalQuery.isLoading) return <CenteredSpinner label="Loading proposal" />;
  if (proposalQuery.error || !proposalQuery.data) {
    return (
      <ErrorState
        heading="Proposal not found"
        message={(proposalQuery.error as Error | null)?.message ?? "Proposal does not exist."}
        onRetry={() => proposalQuery.refetch()}
      />
    );
  }

  const proposal = proposalQuery.data;
  const userId = session?.user?.id ?? "";
  const isAdmin = ability.can("manage", "all");
  const isOwner = proposal.requester_id === userId;
  const canDecide =
    isAdmin && (proposal.status === "SUBMITTED" || proposal.status === "UNDER_REVIEW");
  const canWithdraw = isOwner && (proposal.status === "DRAFT" || proposal.status === "SUBMITTED");

  async function runDecision() {
    if (!decision) return;
    const payload = { decided_by: userId, decision_note: decision.note };
    try {
      if (decision.kind === "approve") {
        await approveMutation.mutateAsync({ id: proposal.id, decision: payload });
        toast.success("Proposal approved");
      } else {
        await denyMutation.mutateAsync({ id: proposal.id, decision: payload });
        toast.success("Proposal denied");
      }
      setDecision(null);
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Action failed";
      toast.error(msg);
    }
  }

  async function runWithdraw() {
    try {
      await withdrawMutation.mutateAsync({ id: proposal.id, requesterId: userId });
      toast.success("Proposal withdrawn");
      router.push("/proposals");
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Failed to withdraw";
      toast.error(msg);
    }
  }

  const totalSU = proposal.resources.reduce((acc, r) => acc + r.requested_su_amount, 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[28px] font-bold leading-tight">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground">
            {proposal.project_title} · submitted {new Date(proposal.created_at).toLocaleString()} by{" "}
            {proposal.requester_id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge variant={statusVariant(proposal.status)} label={proposal.status} />
          {canDecide ? (
            <>
              <Button size="sm" onClick={() => setDecision({ kind: "approve", note: "" })}>
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDecision({ kind: "deny", note: "" })}
              >
                Deny
              </Button>
            </>
          ) : null}
          {canWithdraw ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={runWithdraw}
              disabled={withdrawMutation.isPending}
            >
              Withdraw
            </Button>
          ) : null}
        </div>
      </header>

      <Card className="space-y-4 p-5">
        <h2 className="font-heading text-base font-semibold">Abstract</h2>
        <p className="whitespace-pre-wrap text-sm">{proposal.abstract}</p>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-heading text-base font-semibold">Resources</h2>
        <ul className="space-y-2 text-sm">
          {proposal.resources.map((r) => (
            <li key={r.resource_id} className="flex justify-between border-b pb-2 last:border-b-0">
              <span>
                <span className="font-medium">{r.resource_name}</span>{" "}
                <span className="text-muted-foreground">({r.resource_type})</span>
              </span>
              <span>{r.requested_su_amount.toLocaleString()} SU</span>
            </li>
          ))}
          <li className="flex justify-between pt-1 font-medium">
            <span>Total</span>
            <span>{totalSU.toLocaleString()} SU</span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          {new Date(proposal.start_date).toLocaleDateString()} →{" "}
          {new Date(proposal.end_date).toLocaleDateString()}
        </p>
      </Card>

      <Card className="space-y-3 p-5">
        <h2 className="font-heading text-base font-semibold">Justification</h2>
        <p className="whitespace-pre-wrap text-sm">{proposal.justification}</p>
      </Card>

      {proposal.cascade_to_sub_projects ? (
        <Card className="space-y-3 p-5">
          <h2 className="font-heading text-base font-semibold">Sub-project cascade</h2>
          <ul className="space-y-2 text-sm">
            {proposal.child_allocations.map((c) => (
              <li key={c.project_id} className="flex justify-between border-b pb-2 last:border-b-0">
                <span>{c.project_title}</span>
                <span>{c.su_split_percent}%</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="space-y-3 p-5">
        <h2 className="font-heading text-base font-semibold">Decision timeline</h2>
        <ol className="space-y-3 text-sm">
          <li>
            <p className="text-xs text-muted-foreground">
              {new Date(proposal.created_at).toLocaleString()}
            </p>
            <p>
              Created by <span className="font-medium">{proposal.requester_id}</span>
            </p>
          </li>
          {proposal.decision ? (
            <li>
              <p className="text-xs text-muted-foreground">
                {new Date(proposal.decision.decided_at).toLocaleString()}
              </p>
              <p>
                {proposal.status === "APPROVED" ? "Approved" : "Denied"} by{" "}
                <span className="font-medium">{proposal.decision.decided_by}</span>
              </p>
              {proposal.decision.decision_note ? (
                <p className="text-muted-foreground">"{proposal.decision.decision_note}"</p>
              ) : null}
            </li>
          ) : null}
        </ol>
      </Card>

      <Dialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) setDecision(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision?.kind === "approve" ? "Approve proposal" : "Deny proposal"}
            </DialogTitle>
            <DialogDescription>
              Add an optional note that the requester will see in the timeline.
            </DialogDescription>
          </DialogHeader>
          <textarea
            rows={4}
            value={decision?.note ?? ""}
            onChange={(e) => setDecision((d) => (d ? { ...d, note: e.currentTarget.value } : d))}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Decision note"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              onClick={runDecision}
              disabled={approveMutation.isPending || denyMutation.isPending}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
