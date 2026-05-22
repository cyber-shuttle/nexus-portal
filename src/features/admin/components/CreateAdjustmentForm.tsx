"use client";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import * as React from "react";
import type { AdjustmentType, CreateAdjustmentPayload } from "../schemas";

export type CreateAdjustmentFormProps = {
  isSubmitting: boolean;
  allocationOptions: Array<{ id: string; name: string }>;
  onSubmit: (payload: CreateAdjustmentPayload) => void;
};

export function CreateAdjustmentForm({
  isSubmitting,
  allocationOptions,
  onSubmit,
}: CreateAdjustmentFormProps) {
  const [allocationId, setAllocationId] = React.useState("");
  const [type, setType] = React.useState<AdjustmentType>("CREDIT");
  const [amount, setAmount] = React.useState<string>("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    if (!allocationId) {
      setError("Pick an allocation.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Amount must be a positive integer.");
      return;
    }
    if (reason.trim().length < 3) {
      setError("Reason must be at least 3 characters.");
      return;
    }
    onSubmit({
      allocation_id: allocationId,
      type,
      amount: Math.floor(parsed),
      reason: reason.trim(),
    });
    setAmount("");
    setReason("");
  }

  return (
    <form className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-5" onSubmit={handleSubmit}>
      <div className="md:col-span-2 space-y-1">
        <Label htmlFor="adj-alloc">Allocation</Label>
        <select
          id="adj-alloc"
          value={allocationId}
          onChange={(e) => setAllocationId(e.currentTarget.value)}
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="">Pick allocation…</option>
          {allocationOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="adj-type">Type</Label>
        <select
          id="adj-type"
          value={type}
          onChange={(e) => setType(e.currentTarget.value as AdjustmentType)}
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm"
        >
          <option value="CREDIT">CREDIT</option>
          <option value="DEBIT">DEBIT</option>
          <option value="EXPIRE">EXPIRE</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="adj-amount">Amount (SU)</Label>
        <Input
          id="adj-amount"
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.currentTarget.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="adj-reason">Reason</Label>
        <Input
          id="adj-reason"
          type="text"
          placeholder="≥3 chars"
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
      </div>
      {error ? (
        <p className="md:col-span-5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="md:col-span-5 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Record adjustment"}
        </Button>
      </div>
    </form>
  );
}
