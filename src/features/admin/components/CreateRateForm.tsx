"use client";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import * as React from "react";
import type { CreateRatePayload } from "../schemas";

export type CreateRateFormProps = {
  isSubmitting: boolean;
  onSubmit: (payload: CreateRatePayload) => void;
};

export function CreateRateForm({ isSubmitting, onSubmit }: CreateRateFormProps) {
  const [resourceId, setResourceId] = React.useState("");
  const [rate, setRate] = React.useState<string>("");
  const [from, setFrom] = React.useState<string>(new Date().toISOString().slice(0, 10));
  const [to, setTo] = React.useState<string>(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedRate = Number(rate);
    if (!resourceId.trim()) {
      setError("Resource id is required.");
      return;
    }
    if (!parsedRate || parsedRate <= 0) {
      setError("Rate must be a positive number.");
      return;
    }
    if (Date.parse(from) >= Date.parse(to)) {
      setError("Effective-from must be before effective-to.");
      return;
    }
    onSubmit({
      compute_allocation_resource_id: resourceId.trim(),
      rate: parsedRate,
      effective_from: `${from}T00:00:00Z`,
      effective_to: `${to}T23:59:59Z`,
    });
    setResourceId("");
    setRate("");
  }

  return (
    <form className="grid gap-3 rounded-md border bg-card p-4 md:grid-cols-5" onSubmit={handleSubmit}>
      <div className="md:col-span-2 space-y-1">
        <Label htmlFor="new-rate-resource">Resource id</Label>
        <Input
          id="new-rate-resource"
          placeholder="alloc-001-res-1"
          value={resourceId}
          onChange={(e) => setResourceId(e.currentTarget.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-rate-value">SU/unit</Label>
        <Input
          id="new-rate-value"
          type="number"
          step="0.01"
          min={0}
          value={rate}
          onChange={(e) => setRate(e.currentTarget.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-rate-from">Effective from</Label>
        <Input
          id="new-rate-from"
          type="date"
          value={from}
          onChange={(e) => setFrom(e.currentTarget.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="new-rate-to">Effective to</Label>
        <Input
          id="new-rate-to"
          type="date"
          value={to}
          onChange={(e) => setTo(e.currentTarget.value)}
        />
      </div>
      {error ? (
        <p className="md:col-span-5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="md:col-span-5 flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Add rate"}
        </Button>
      </div>
    </form>
  );
}
