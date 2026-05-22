"use client";

import { PacketDetailDrawer } from "@features/amie/components/PacketDetailDrawer";
import { type PacketFilters, PacketInboxTable } from "@features/amie/components/PacketInboxTable";
import { PacketsTrendChart } from "@features/amie/components/PacketsTrendChart";
import {
  usePacket,
  usePacketEvents,
  usePacketStats,
  usePackets,
  useResolvePacket,
  useRetryPacket,
} from "@features/amie/queries";
import type { Packet } from "@features/amie/types";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

const DEFAULT_PAGE_SIZE = 20;

const DEFAULT_FILTERS: PacketFilters = {
  status: "all",
  type: "all",
  source: "all",
  q: "",
};

export function PacketInboxContainer({ initialPacketId }: { initialPacketId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const drawerIdFromUrl = initialPacketId ?? searchParams.get("packet") ?? undefined;

  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState<PacketFilters>(DEFAULT_FILTERS);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = React.useState<string | undefined>(drawerIdFromUrl);

  React.useEffect(() => {
    setSelectedId(drawerIdFromUrl);
  }, [drawerIdFromUrl]);

  const packetsQuery = usePackets({
    status: filters.status !== "all" ? filters.status : undefined,
    type: filters.type !== "all" ? filters.type : undefined,
    source: filters.source !== "all" ? filters.source : undefined,
    q: filters.q || undefined,
    limit: DEFAULT_PAGE_SIZE,
    offset: (page - 1) * DEFAULT_PAGE_SIZE,
  });

  const statsQuery = usePacketStats({ window: "30d" });
  const detailQuery = usePacket(selectedId);
  const eventsQuery = usePacketEvents(selectedId);
  const retryMutation = useRetryPacket();
  const resolveMutation = useResolvePacket();

  const rows = packetsQuery.data?.packets ?? [];
  const total = packetsQuery.data?.total ?? 0;

  function openDrawer(packet: Packet) {
    setSelectedId(packet.id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("packet", packet.id);
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  function closeDrawer() {
    setSelectedId(undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("packet");
    const next = params.toString();
    router.replace(next ? `?${next}` : "?", { scroll: false });
  }

  async function handleBulkRetry() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let queued = 0;
    for (const id of ids) {
      try {
        await retryMutation.mutateAsync(id);
        queued += 1;
      } catch {
        // continue — surface aggregate result below
      }
    }
    toast.success(`Queued ${queued} retry${queued === 1 ? "" : "s"}`);
    setSelected(new Set());
  }

  async function handleBulkMarkProcessed() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    let resolved = 0;
    for (const id of ids) {
      try {
        await resolveMutation.mutateAsync({ id, reason: "Bulk mark processed" });
        resolved += 1;
      } catch {
        // continue
      }
    }
    toast.success(`Marked ${resolved} packet${resolved === 1 ? "" : "s"} processed`);
    setSelected(new Set());
  }

  function handleBulkExport() {
    const exported = rows.filter((r) => selected.has(r.id));
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amie-packets-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDrawerRetry() {
    if (!detailQuery.data) return;
    try {
      await retryMutation.mutateAsync(detailQuery.data.id);
      toast.success("Retry queued");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    }
  }

  async function handleDrawerResolve(reason: string) {
    if (!detailQuery.data) return;
    try {
      await resolveMutation.mutateAsync({ id: detailQuery.data.id, reason });
      toast.success("Packet resolved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resolve failed");
    }
  }

  return (
    <div className="space-y-6">
      <PacketsTrendChart buckets={statsQuery.data?.byDay ?? []} />
      <PacketInboxTable
        rows={rows}
        total={total}
        isLoading={packetsQuery.isLoading}
        error={packetsQuery.error}
        page={page}
        pageSize={DEFAULT_PAGE_SIZE}
        filters={filters}
        selected={selected}
        onSelectChange={setSelected}
        onFiltersChange={(next) => {
          setFilters(next);
          setPage(1);
          setSelected(new Set());
        }}
        onPageChange={setPage}
        onRowClick={openDrawer}
        onBulkRetry={handleBulkRetry}
        onBulkMarkProcessed={handleBulkMarkProcessed}
        onBulkExport={handleBulkExport}
        onRetry={() => packetsQuery.refetch()}
      />

      <PacketDetailDrawer
        open={selectedId != null}
        onOpenChange={(open) => {
          if (!open) closeDrawer();
        }}
        packet={detailQuery.data}
        events={eventsQuery.data ?? []}
        isLoading={detailQuery.isLoading}
        eventsLoading={eventsQuery.isLoading}
        error={detailQuery.error}
        canRetry
        canResolve
        onRetry={handleDrawerRetry}
        onResolve={handleDrawerResolve}
        onRefresh={() => {
          detailQuery.refetch();
          eventsQuery.refetch();
        }}
      />
    </div>
  );
}
