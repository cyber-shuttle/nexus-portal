"use client";

import { ErrorState } from "@/shared/ui/ErrorState";
import { CenteredSpinner } from "@/shared/ui/Loading";
import { useAllocations } from "@features/allocations/queries";
import { useProjectsAsPi } from "@features/projects/queries";
import { ProposalWizard } from "@features/proposals/components/ProposalWizard";
import { useAbility } from "@shared/casl/AbilityProvider";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import * as React from "react";

export function NewProposalContainer() {
  const router = useRouter();
  const { data: session } = useSession();
  const ability = useAbility();
  const userId = session?.user?.id ?? "";
  const canCreate = ability.can("create", "Proposal");

  const projectsQuery = useProjectsAsPi(canCreate ? userId : undefined);
  const projects = projectsQuery.data ?? [];

  const allocationIds = React.useMemo(
    () => session?.user?.myPiAllocations ?? [],
    [session?.user?.myPiAllocations],
  );
  const allocationsQuery = useAllocations(allocationIds);

  // For Phase 4 MSW the resource pool is sampled from the PI's own allocations.
  // When PI has no allocation rows yet we fall back to a small static catalog
  // mirroring the seeded resource names so the wizard's resource picker still works.
  const resourceOptions = React.useMemo(() => {
    const fromAllocs = (allocationsQuery.data ?? []).flatMap(() => []);
    if (fromAllocs.length > 0) return fromAllocs;
    return [
      { id: "alloc-001-res-1", name: "cpu-standard", resource_type: "cpu" },
      { id: "alloc-001-res-2", name: "gpu-a100", resource_type: "gpu" },
      { id: "alloc-001-res-3", name: "gpu-h100", resource_type: "gpu" },
      { id: "alloc-001-res-4", name: "cpu-largemem", resource_type: "cpu" },
    ];
  }, [allocationsQuery.data]);

  if (!canCreate) {
    return <ErrorState heading="Not permitted" message="Only project PIs can create proposals." />;
  }

  if (projectsQuery.isLoading) return <CenteredSpinner label="Loading projects" />;
  if (projectsQuery.error) {
    return (
      <ErrorState
        message={(projectsQuery.error as Error).message ?? "Failed to load projects"}
        onRetry={() => projectsQuery.refetch()}
      />
    );
  }

  const projectOptions = projects.map((p) => ({
    id: p.id,
    title: p.title,
    children: [
      { id: `${p.id}-sub-a`, title: `${p.title} — Sub A` },
      { id: `${p.id}-sub-b`, title: `${p.title} — Sub B` },
    ],
  }));

  return (
    <ProposalWizard
      projectOptions={projectOptions}
      resourceOptions={resourceOptions}
      requesterId={userId}
      onCancel={() => router.push("/proposals")}
    />
  );
}
