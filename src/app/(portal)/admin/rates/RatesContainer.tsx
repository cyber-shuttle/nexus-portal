"use client";

import { CreateRateForm } from "@features/admin/components/CreateRateForm";
import { RatesTable } from "@features/admin/components/RatesTable";
import {
  useAdminRates,
  useCreateAdminRate,
  useDeactivateAdminRate,
} from "@features/admin/queries";
import { useAbility } from "@shared/casl/AbilityProvider";
import { ErrorState } from "@/shared/ui/ErrorState";
import * as React from "react";
import { toast } from "sonner";

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
        <h1 className="font-display text-2xl font-bold tracking-tight">Resource rates</h1>
        <p className="text-sm text-muted-foreground">
          Versioned SU/unit rates per resource. New rates supersede the active one; deactivating
          ends the validity window at <em>now</em>.
        </p>
      </header>

      <CreateRateForm
        isSubmitting={createMutation.isPending}
        onSubmit={(payload) => {
          createMutation.mutate(payload, {
            onSuccess: () => toast.success("Rate added"),
            onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add rate"),
          });
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
