"use client";

import { UnmappedJobsTable } from "@features/admin/components/UnmappedJobsTable";
import {
  useAdminAllocations,
  useDiscardUnmappedJob,
  useLinkUnmappedJob,
  useUnmappedJobs,
} from "@features/admin/queries";
import { useAbility } from "@shared/casl/AbilityProvider";
import { ErrorState } from "@/shared/ui/ErrorState";
import * as React from "react";
import { toast } from "sonner";

export function UnmappedJobsContainer() {
  const ability = useAbility();
  const allowed = ability.can("manage", "all") || ability.can("manage", "UnmappedJob");

  const jobsQuery = useUnmappedJobs();
  const allocationsQuery = useAdminAllocations({ status: "ACTIVE", limit: 100 });
  const linkMutation = useLinkUnmappedJob();
  const discardMutation = useDiscardUnmappedJob();

  if (!allowed) {
    return (
      <ErrorState heading="Not permitted" message="Only site admins can resolve unmapped jobs." />
    );
  }

  const allocations = allocationsQuery.data ?? [];
  const allocationOptions = allocations.map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">Unmapped jobs</h1>
        <p className="text-sm text-muted-foreground">
          SLURM accounting records that couldn't be matched to a known allocation. Link to the
          right allocation or discard with a reason.
        </p>
      </header>

      <UnmappedJobsTable
        rows={jobsQuery.data ?? []}
        isLoading={jobsQuery.isLoading}
        error={jobsQuery.error}
        allocationOptions={allocationOptions}
        onLink={(job, allocationId) =>
          linkMutation.mutate(
            { id: job.id, allocation_id: allocationId },
            {
              onSuccess: () => toast.success(`Linked ${job.job_id} to ${allocationId}`),
              onError: (err) =>
                toast.error(err instanceof Error ? err.message : "Failed to link job"),
            },
          )
        }
        onDiscard={(job, reason) =>
          discardMutation.mutate(
            { id: job.id, reason },
            {
              onSuccess: () => toast.success(`Discarded ${job.job_id}`),
              onError: (err) =>
                toast.error(err instanceof Error ? err.message : "Failed to discard job"),
            },
          )
        }
        onRefresh={() => jobsQuery.refetch()}
      />
    </div>
  );
}
