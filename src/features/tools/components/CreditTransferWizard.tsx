"use client";

import { StatusBadge } from "@/shared/ui/StatusBadge";
import { Button } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { ApiError } from "@shared/api/client";
import { CheckCircle2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { useTransferCredits } from "../queries";
import type { CreditTransferResult } from "../types";

// Structural shapes — the route layer maps Allocation / Resource into these so
// the tools feature stays isolated from features/allocations.
export type CreditTransferAllocation = {
  id: string;
  name: string;
  status: string;
  remaining_su: number;
  used_su: number;
};

export type CreditTransferResource = {
  id: string;
  name: string;
  resource_type: string;
};

export type CreditTransferWizardProps = {
  transferableAllocations: CreditTransferAllocation[];
  resourcesByAllocation: Record<string, CreditTransferResource[]>;
  transferredBy: string;
};

type Step = "source" | "amount" | "destination" | "review" | "result";

const STEP_ORDER: Step[] = ["source", "amount", "destination", "review", "result"];

function StepIndicator({ current }: { current: Step }) {
  const labels: Record<Step, string> = {
    source: "Source",
    amount: "Amount",
    destination: "Destination",
    review: "Review",
    result: "Result",
  };
  const currentIndex = STEP_ORDER.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-1 text-xs">
      {STEP_ORDER.map((s, i) => (
        <li
          key={s}
          aria-current={s === current ? "step" : undefined}
          className={
            i <= currentIndex
              ? "rounded-md bg-primary/10 px-2 py-1 font-medium text-primary"
              : "rounded-md bg-muted px-2 py-1 text-muted-foreground"
          }
        >
          {i + 1}. {labels[s]}
        </li>
      ))}
    </ol>
  );
}

export function CreditTransferWizard({
  transferableAllocations,
  resourcesByAllocation,
  transferredBy,
}: CreditTransferWizardProps) {
  const [step, setStep] = React.useState<Step>("source");
  const [sourceId, setSourceId] = React.useState<string>("");
  const [resourceId, setResourceId] = React.useState<string>("");
  const [amount, setAmount] = React.useState<number>(0);
  const [destinationId, setDestinationId] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");
  const [result, setResult] = React.useState<CreditTransferResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const mutation = useTransferCredits();

  const source = transferableAllocations.find((a) => a.id === sourceId);
  const destination = transferableAllocations.find((a) => a.id === destinationId);
  const sourceResources = resourcesByAllocation[sourceId] ?? [];
  const eligibleDestinations = transferableAllocations.filter(
    (a) => a.id !== sourceId && a.status === "ACTIVE",
  );

  function validateAndAdvance(next: Step) {
    setError(null);
    if (step === "source" && !sourceId) {
      setError("Pick a source allocation.");
      return;
    }
    if (step === "amount") {
      if (!resourceId) {
        setError("Pick a resource.");
        return;
      }
      if (!source || amount <= 0) {
        setError("Enter a positive SU amount.");
        return;
      }
      if (amount > source.remaining_su) {
        setError(`Amount exceeds remaining balance (${source.remaining_su.toLocaleString()} SU).`);
        return;
      }
    }
    if (step === "destination") {
      if (!destinationId) {
        setError("Pick a destination allocation.");
        return;
      }
      if (destinationId === sourceId) {
        setError("Source and destination must differ.");
        return;
      }
    }
    setStep(next);
  }

  function goBack() {
    setError(null);
    const i = STEP_ORDER.indexOf(step);
    if (i > 0) setStep(STEP_ORDER[i - 1] as Step);
  }

  async function confirm() {
    setError(null);
    try {
      const res = await mutation.mutateAsync({
        source_allocation_id: sourceId,
        destination_allocation_id: destinationId,
        compute_allocation_resource_id: resourceId,
        su_amount: amount,
        transferred_by: transferredBy,
        note: note || undefined,
      });
      setResult(res);
      setStep("result");
      toast.success(`Transferred ${res.su_amount.toLocaleString()} SU — ${res.transfer_id}`);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? `Failed (${err.status}): ${typeof err.body === "object" && err.body && "error" in err.body ? String((err.body as { error: string }).error) : err.message}`
          : "Transfer failed";
      setError(msg);
      toast.error(msg);
    }
  }

  function restart() {
    setSourceId("");
    setResourceId("");
    setAmount(0);
    setDestinationId("");
    setNote("");
    setResult(null);
    setError(null);
    setStep("source");
  }

  return (
    <div className="space-y-5">
      <StepIndicator current={step} />

      <Card className="p-5">
        {step === "source" ? (
          <div className="space-y-4">
            <header>
              <h2 className="font-heading text-lg font-semibold">Pick source allocation</h2>
              <p className="text-sm text-muted-foreground">
                Only ACTIVE allocations with remaining credits are listed.
              </p>
            </header>
            <ol className="space-y-2" aria-label="Source allocations">
              {transferableAllocations
                .filter((a) => a.status === "ACTIVE" && a.remaining_su > 0)
                .map((a) => (
                  <li key={a.id}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 hover:bg-muted/20">
                      <input
                        type="radio"
                        name="source"
                        value={a.id}
                        checked={sourceId === a.id}
                        onChange={() => setSourceId(a.id)}
                        className="mt-1"
                      />
                      <span className="flex-1">
                        <span className="block font-medium">{a.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {a.id} · ACTIVE · remaining {a.remaining_su.toLocaleString()} of{" "}
                          {(a.remaining_su + a.used_su).toLocaleString()} SU
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
            </ol>
          </div>
        ) : null}

        {step === "amount" && source ? (
          <div className="space-y-4">
            <header>
              <h2 className="font-heading text-lg font-semibold">Resource & amount</h2>
              <p className="text-sm text-muted-foreground">
                Source: <span className="font-medium">{source.name}</span> — remaining{" "}
                {source.remaining_su.toLocaleString()} SU.
              </p>
            </header>
            <div className="space-y-2">
              <Label htmlFor="xfer-resource">Resource</Label>
              <select
                id="xfer-resource"
                value={resourceId}
                onChange={(e) => setResourceId(e.currentTarget.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Select a resource…</option>
                {sourceResources.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.resource_type})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="xfer-amount">SU amount</Label>
              <Input
                id="xfer-amount"
                type="number"
                min={1}
                max={source.remaining_su}
                value={amount || ""}
                onChange={(e) => setAmount(Number(e.currentTarget.value))}
              />
              <p className="text-xs text-muted-foreground">
                Cannot exceed {source.remaining_su.toLocaleString()} SU.
              </p>
            </div>
          </div>
        ) : null}

        {step === "destination" ? (
          <div className="space-y-4">
            <header>
              <h2 className="font-heading text-lg font-semibold">Pick destination</h2>
              <p className="text-sm text-muted-foreground">
                Destination must be ACTIVE and different from the source.
              </p>
            </header>
            <ol className="space-y-2" aria-label="Destination allocations">
              {eligibleDestinations.map((a) => (
                <li key={a.id}>
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 hover:bg-muted/20">
                    <input
                      type="radio"
                      name="destination"
                      value={a.id}
                      checked={destinationId === a.id}
                      onChange={() => setDestinationId(a.id)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{a.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {a.id} · ACTIVE · current {a.remaining_su.toLocaleString()} SU
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {step === "review" && source && destination ? (
          <div className="space-y-4">
            <header>
              <h2 className="font-heading text-lg font-semibold">Review transfer</h2>
              <p className="text-sm text-muted-foreground">Confirm the math before we commit.</p>
            </header>
            <div className="grid gap-3 md:grid-cols-2">
              <Card className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Source</p>
                <p className="mt-1 font-medium">{source.name}</p>
                <p className="text-xs text-muted-foreground">{source.id}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Before</dt>
                    <dd>{source.remaining_su.toLocaleString()} SU</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">After</dt>
                    <dd>{Math.max(0, source.remaining_su - amount).toLocaleString()} SU</dd>
                  </div>
                </dl>
              </Card>
              <Card className="p-4">
                <p className="text-xs uppercase text-muted-foreground">Destination</p>
                <p className="mt-1 font-medium">{destination.name}</p>
                <p className="text-xs text-muted-foreground">{destination.id}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Before</dt>
                    <dd>{destination.remaining_su.toLocaleString()} SU</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">After</dt>
                    <dd>{(destination.remaining_su + amount).toLocaleString()} SU</dd>
                  </div>
                </dl>
              </Card>
            </div>
            <div className="space-y-2">
              <Label htmlFor="xfer-note">Note (optional)</Label>
              <textarea
                id="xfer-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.currentTarget.value)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Why are you moving these credits? Surfaced in the audit diff on both sides."
              />
            </div>
          </div>
        ) : null}

        {step === "result" && result ? (
          <div className="space-y-3 text-center">
            <CheckCircle2Icon className="mx-auto h-10 w-10 text-emerald-500" aria-hidden />
            <h2 className="font-heading text-lg font-semibold">Transfer complete</h2>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{result.su_amount.toLocaleString()} SU</span> moved.
              Transfer id <code>{result.transfer_id}</code>.
            </p>
            <div className="mx-auto grid max-w-xl gap-3 md:grid-cols-2">
              <Card className="p-4 text-left">
                <p className="text-xs uppercase text-muted-foreground">Source balance</p>
                <p className="mt-1 font-medium">
                  {result.source_balance_after.toLocaleString()} SU
                </p>
                <p className="text-xs text-muted-foreground">{result.source_allocation_id}</p>
                <StatusBadge variant="active" className="mt-2" />
              </Card>
              <Card className="p-4 text-left">
                <p className="text-xs uppercase text-muted-foreground">Destination balance</p>
                <p className="mt-1 font-medium">
                  {result.destination_balance_after.toLocaleString()} SU
                </p>
                <p className="text-xs text-muted-foreground">{result.destination_allocation_id}</p>
                <StatusBadge variant="active" className="mt-2" />
              </Card>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={goBack}
            disabled={step === "source" || step === "result"}
          >
            Back
          </Button>
          {step === "source" ? (
            <Button onClick={() => validateAndAdvance("amount")}>Next</Button>
          ) : null}
          {step === "amount" ? (
            <Button onClick={() => validateAndAdvance("destination")}>Next</Button>
          ) : null}
          {step === "destination" ? (
            <Button onClick={() => validateAndAdvance("review")}>Next</Button>
          ) : null}
          {step === "review" ? (
            <Button onClick={confirm} disabled={mutation.isPending}>
              {mutation.isPending ? "Transferring…" : "Confirm transfer"}
            </Button>
          ) : null}
          {step === "result" ? <Button onClick={restart}>Start another transfer</Button> : null}
        </div>
      </Card>
    </div>
  );
}
