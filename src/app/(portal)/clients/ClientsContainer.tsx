"use client";

import { subject } from "@casl/ability";
import { useAllocations } from "@features/allocations/queries";
import { ClientDetailDrawer } from "@features/clients/components/ClientDetailDrawer";
import { ClientList } from "@features/clients/components/ClientList";
import { CreateClientDialog } from "@features/clients/components/CreateClientDialog";
import { useClient, useClients } from "@features/clients/queries";
import type { ClientStatus } from "@features/clients/types";
import { useAbility } from "@shared/casl/AbilityProvider";
import { useSession } from "next-auth/react";
import * as React from "react";

export function ClientsContainer() {
  const { data: session } = useSession();
  const ability = useAbility();
  const userId = session?.user?.id ?? "";
  const isAdmin = session?.systemRole === "admin";
  const piAllocationIds = session?.user?.myPiAllocations ?? [];

  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(10);
  const [statusFilter, setStatusFilter] = React.useState<ClientStatus | "all">("all");
  const [allocationFilter, setAllocationFilter] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState(isAdmin ? "" : userId);
  const [selectedId, setSelectedId] = React.useState<string | undefined>();
  const [createOpenKey, setCreateOpenKey] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!isAdmin && userId) setOwnerFilter(userId);
  }, [isAdmin, userId]);

  const clientsQuery = useClients({
    status: statusFilter,
    allocationId: allocationFilter || undefined,
    ownerUserId: ownerFilter || undefined,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const allRows = clientsQuery.data?.clients ?? [];
  const rows = React.useMemo(
    () =>
      allRows.filter((c) =>
        ability.can(
          "read",
          subject("Client", {
            owner_user_id: c.owner_user_id,
            allocation_id: c.allocation_id,
          }),
        ),
      ),
    [allRows, ability],
  );
  const total = clientsQuery.data?.total ?? rows.length;

  const selectedQuery = useClient(selectedId);

  const piAllocations = useAllocations(piAllocationIds);
  const allocationOptions = (piAllocations.data ?? []).map((a) => ({ id: a.id, name: a.name }));
  const canCreate = ability.can("create", "Client") && allocationOptions.length > 0;
  // Recompute per row: a PI may manage clients on their allocation but not on
  // someone else's; an admin manages all; a researcher only their own owner_user_id.
  const canManageClient = React.useCallback(
    (c: { owner_user_id: string; allocation_id: string } | undefined) => {
      if (!c) return false;
      return ability.can(
        "manage",
        subject("Client", { owner_user_id: c.owner_user_id, allocation_id: c.allocation_id }),
      );
    },
    [ability],
  );

  return (
    <>
      <ClientList
        rows={rows}
        total={total}
        isLoading={clientsQuery.isLoading}
        error={clientsQuery.error}
        page={page}
        pageSize={pageSize}
        statusFilter={statusFilter}
        allocationFilter={allocationFilter}
        ownerFilter={ownerFilter}
        canCreate={canCreate}
        onPageChange={setPage}
        onStatusChange={(s) => {
          setStatusFilter(s);
          setPage(1);
        }}
        onAllocationChange={(a) => {
          setAllocationFilter(a);
          setPage(1);
        }}
        onOwnerChange={(o) => {
          setOwnerFilter(o);
          setPage(1);
        }}
        onCreate={() => setCreateOpenKey((k) => (k ?? 0) + 1)}
        onRowClick={(c) => setSelectedId(c.id)}
        onRetry={() => clientsQuery.refetch()}
      />

      {canCreate && createOpenKey != null && (
        <CreateClientDialogPortal
          key={createOpenKey}
          allocationOptions={allocationOptions}
          defaultOwnerUserId={userId}
        />
      )}

      <ClientDetailDrawer
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(undefined);
        }}
        client={selectedQuery.data}
        isLoading={selectedQuery.isLoading}
        error={selectedQuery.error}
        canManage={canManageClient(selectedQuery.data)}
        currentUserId={userId}
        onRetry={() => selectedQuery.refetch()}
      />
    </>
  );
}

// We mount the dialog with auto-open behavior keyed on a counter so the New
// client button in the list opens it; the dialog still owns its own visible
// state once interacted with.
function CreateClientDialogPortal({
  allocationOptions,
  defaultOwnerUserId,
}: {
  allocationOptions: { id: string; name: string }[];
  defaultOwnerUserId: string;
}) {
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    triggerRef.current?.click();
  }, []);
  return (
    <CreateClientDialog
      trigger={<button ref={triggerRef} type="button" className="sr-only" tabIndex={-1} />}
      allocationOptions={allocationOptions}
      defaultOwnerUserId={defaultOwnerUserId}
    />
  );
}
