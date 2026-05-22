"use client";

import { AdjustmentsTable } from "@features/admin/components/AdjustmentsTable";
import { CreateAdjustmentForm } from "@features/admin/components/CreateAdjustmentForm";
import {
  useAdjustments,
  useAdminAllocations,
  useCreateAdjustment,
} from "@features/admin/queries";
import type { AdjustmentType } from "@features/admin/schemas";
import { useAbility } from "@shared/casl/AbilityProvider";
import { ErrorState } from "@/shared/ui/ErrorState";
import * as React from "react";
import { toast } from "sonner";

export function AdjustmentsContainer() {
  const ability = useAbility();
  const allowed = ability.can("manage", "all") || ability.can("manage", "Adjustment");

  const [typeFilter, setTypeFilter] = React.useState<AdjustmentType | "all">("all");
  const adjustmentsQuery = useAdjustments({ type: typeFilter });
  const allocationsQuery = useAdminAllocations({ status: "ACTIVE", limit: 100 });
  const createMutation = useCreateAdjustment();

  if (!allowed) {
    return (
      <ErrorState heading="Not permitted" message="Only site admins can record adjustments." />
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">Adjustments</h1>
        <p className="text-sm text-muted-foreground">
          Manual SU credits, debits, and expirations against allocations. All entries are
          irreversible — record a reason for the audit trail.
        </p>
      </header>

      <CreateAdjustmentForm
        isSubmitting={createMutation.isPending}
        allocationOptions={(allocationsQuery.data ?? []).map((a) => ({ id: a.id, name: a.name }))}
        onSubmit={(payload) =>
          createMutation.mutate(payload, {
            onSuccess: () => toast.success("Adjustment recorded"),
            onError: (err) =>
              toast.error(err instanceof Error ? err.message : "Failed to record adjustment"),
          })
        }
      />

      <AdjustmentsTable
        rows={adjustmentsQuery.data ?? []}
        isLoading={adjustmentsQuery.isLoading}
        error={adjustmentsQuery.error}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        onRefresh={() => adjustmentsQuery.refetch()}
      />
    </div>
  );
}
