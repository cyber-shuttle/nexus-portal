"use client";

import { ReconciliationQueue } from "@features/amie/components/ReconciliationQueue";
import { useLinkUnmapped, useResolvePacket, useUnmapped } from "@features/amie/queries";
import type { Packet } from "@features/amie/types";
import * as React from "react";
import { toast } from "sonner";

export function ReconciliationContainer() {
  const unmappedQuery = useUnmapped({ limit: 100 });
  const linkMutation = useLinkUnmapped();
  const resolveMutation = useResolvePacket();
  const rows = unmappedQuery.data?.packets ?? [];

  async function handleLink(packet: Packet, entity_type: string, entity_id: string) {
    try {
      await linkMutation.mutateAsync({ id: packet.id, entity_type, entity_id });
      toast.success(`Linked to ${entity_type} ${entity_id} — audit entry created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Link failed");
    }
  }

  async function handleSkip(packet: Packet, reason: string) {
    try {
      await resolveMutation.mutateAsync({ id: packet.id, reason: `Skip — ${reason}` });
      toast.success(`Skipped ${packet.amie_id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Skip failed");
    }
  }

  return (
    <ReconciliationQueue
      rows={rows}
      total={unmappedQuery.data?.total ?? rows.length}
      isLoading={unmappedQuery.isLoading}
      error={unmappedQuery.error}
      onLink={handleLink}
      onSkip={handleSkip}
      onRefresh={() => unmappedQuery.refetch()}
    />
  );
}
