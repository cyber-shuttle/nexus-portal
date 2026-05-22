"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { ApiError } from "@shared/api/client";
import { useCreateChangeRequest } from "../queries";

const REASON_MIN = 20;

const requestExtensionSchema = z.object({
  requested_change_type: z.enum(["EXTEND_END_DATE", "INCREASE_CREDITS", "OTHER"]),
  requested_amount: z.number().int().positive().optional(),
  requested_end_date: z.string().optional(),
  reason: z.string().min(REASON_MIN, `Reason must be at least ${REASON_MIN} characters`),
});

type FormValues = z.infer<typeof requestExtensionSchema>;

export type RequestExtensionFormProps = {
  allocationId: string;
  requesterId: string;
  currentSuAmount: number;
  onSuccess?: () => void;
  onCancel?: () => void;
};

export function RequestExtensionForm({
  allocationId,
  requesterId,
  currentSuAmount,
  onSuccess,
  onCancel,
}: RequestExtensionFormProps) {
  const createMutation = useCreateChangeRequest();

  const form = useForm<FormValues>({
    resolver: zodResolver(requestExtensionSchema),
    defaultValues: {
      requested_change_type: "INCREASE_CREDITS",
      reason: "",
    },
    mode: "onBlur",
  });

  const changeType = form.watch("requested_change_type");

  const onSubmit = form.handleSubmit(async (values) => {
    // Backend models requested_su_amount (current + delta) and requested_status; the
    // portal-level "change type" is captured by which numeric field the user filled in.
    const requestedSuAmount =
      values.requested_change_type === "INCREASE_CREDITS"
        ? currentSuAmount + (values.requested_amount ?? 0)
        : currentSuAmount;

    const reasonWithMeta =
      values.requested_change_type === "EXTEND_END_DATE" && values.requested_end_date
        ? `[EXTEND_END_DATE → ${values.requested_end_date}] ${values.reason}`
        : values.requested_change_type === "OTHER"
          ? `[OTHER] ${values.reason}`
          : values.reason;

    try {
      await createMutation.mutateAsync({
        compute_allocation_id: allocationId,
        requested_su_amount: requestedSuAmount,
        requested_status: "ACTIVE",
        reason: reasonWithMeta,
        requester_id: requesterId,
      });
      toast.success("Request submitted");
      form.reset();
      onSuccess?.();
    } catch (err) {
      const msg =
        err instanceof ApiError ? `Failed (${err.status}): ${err.message}` : "Failed to submit";
      toast.error(msg);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" aria-label="Request extension form">
      <div className="space-y-2">
        <Label htmlFor="cr-type">Change type</Label>
        <Select
          value={changeType}
          onValueChange={(v) =>
            form.setValue("requested_change_type", v as FormValues["requested_change_type"], {
              shouldValidate: true,
            })
          }
        >
          <SelectTrigger id="cr-type" aria-label="Change type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INCREASE_CREDITS">Increase credits (SUs)</SelectItem>
            <SelectItem value="EXTEND_END_DATE">Extend end date</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {changeType === "INCREASE_CREDITS" ? (
        <div className="space-y-2">
          <Label htmlFor="cr-amount">Additional SUs requested</Label>
          <Input
            id="cr-amount"
            type="number"
            min={1}
            placeholder="e.g. 10000"
            {...form.register("requested_amount", { valueAsNumber: true })}
          />
          {form.formState.errors.requested_amount ? (
            <p className="text-xs text-destructive">
              {form.formState.errors.requested_amount.message}
            </p>
          ) : null}
        </div>
      ) : null}

      {changeType === "EXTEND_END_DATE" ? (
        <div className="space-y-2">
          <Label htmlFor="cr-end">Requested new end date</Label>
          <Input id="cr-end" type="date" {...form.register("requested_end_date")} />
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="cr-reason">
          Reason <span className="text-muted-foreground">(min {REASON_MIN} chars)</span>
        </Label>
        <textarea
          id="cr-reason"
          rows={5}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          placeholder="Why is this change needed? (e.g. milestone push, new collaborators, schedule slip)"
          {...form.register("reason")}
        />
        {form.formState.errors.reason ? (
          <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "Submitting…" : "Submit request"}
        </Button>
      </div>
    </form>
  );
}
