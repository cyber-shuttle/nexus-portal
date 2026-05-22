"use client";

import { CreateRateForm } from "@features/admin/components/CreateRateForm";
import { RatesTable } from "@features/admin/components/RatesTable";
import {
  useAdminRates,
  useCreateAdminRate,
  useDeactivateAdminRate,
} from "@features/admin/queries";
import { ApiError } from "@shared/api/client";
import { useAbility } from "@shared/casl/AbilityProvider";
import { ErrorState } from "@/shared/ui/ErrorState";
import * as React from "react";
import { toast } from "sonner";

function describeCreateError(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    const body = err.body as { error?: string; existing_rate_id?: string } | null;
    if (body?.error === "rate_overlaps_existing") {
      return body.existing_rate_id
        ? `Overlaps existing rate ${body.existing_rate_id}. Supersede it first or pick a non-overlapping window.`
        : "Overlaps an existing rate window for this resource.";
    }
  }
  return err instanceof Error ? err.message : "Failed to add rate";
}

export function RatesContainer() {
  const ability = useAbility();
  const allowed = ability.can("manage", "all") || ability.can("manage", "Rate");
  const ratesQuery = useAdminRates();
  const createMutation = useCreateAdminRate();
  const deactivateMutation = useDeactivateAdminRate();

  if (!allowed) {
    return (
      <ErrorState heading="Not permitted" message="Only site admins can manage resource rates." />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-[28px] font-bold leading-tight">Resource rates</h1>
        <p className="text-sm text-muted-foreground">
          Versioned SU/unit rates per resource. New rates supersede the active one; deactivating
          ends the validity window at <em>now</em>.
        </p>
      </header>

      <CreateRateForm
        isSubmitting={createMutation.isPending}
        onSubmit={async (payload) => {
          try {
            await createMutation.mutateAsync(payload);
            toast.success("Rate added");
            return true;
          } catch (err) {
            toast.error(describeCreateError(err));
            return false;
          }
        }}
      />

      <RatesTable
        rows={ratesQuery.data ?? []}
        isLoading={ratesQuery.isLoading}
        error={ratesQuery.error}
        onDeactivate={(id) => {
          deactivateMutation.mutate(id, {
            onSuccess: () => toast.success("Rate superseded"),
            onError: (err) =>
              toast.error(err instanceof Error ? err.message : "Failed to deactivate rate"),
          });
        }}
        onRefresh={() => ratesQuery.refetch()}
      />
    </div>
  );
}
