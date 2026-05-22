"use client";

import { DataTable, type DataTableColumn } from "@/shared/ui/DataTable";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { TableSkeleton } from "@/shared/ui/Loading";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import * as React from "react";
import type { Packet } from "../types";
import { formatDate } from "../utils";

type Row = Packet & { _draftEntityId?: string; _draftEntityType?: string };

export type ReconciliationQueueProps = {
  rows: Packet[];
  total: number;
  isLoading: boolean;
  error: Error | null;
  onLink: (packet: Packet, entity_type: string, entity_id: string) => void;
  onSkip: (packet: Packet, reason: string) => void;
  onRefresh: () => void;
};

export function ReconciliationQueue({
  rows,
  total,
  isLoading,
  error,
  onLink,
  onSkip,
  onRefresh,
}: ReconciliationQueueProps) {
  const [drafts, setDrafts] = React.useState<Record<string, { type: string; id: string }>>({});
  const [skipDraft, setSkipDraft] = React.useState<Record<string, string>>({});

  function setDraft(id: string, key: "type" | "id", value: string) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { type: "project", id: "", ...prev[id], [key]: value },
    }));
  }

  const columns: DataTableColumn<Row>[] = [
    {
      key: "amie_id",
      header: "AMIE ID",
      cell: (r) => <span className="font-mono text-sm">{r.amie_id}</span>,
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span className="text-sm">{r.type}</span>,
    },
    {
      key: "received",
      header: "Received",
      cell: (r) => (
        <span className="text-xs tabular-nums text-muted-foreground">
          {formatDate(r.received_at)}
        </span>
      ),
    },
    {
      key: "link",
      header: "Link to existing entity",
      cell: (r) => {
        const draft = drafts[r.id] ?? { type: "project", id: "" };
        return (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.id.trim()) return;
              onLink(r, draft.type, draft.id.trim());
            }}
          >
            <select
              aria-label={`Entity type for ${r.amie_id}`}
              value={draft.type}
              onChange={(e) => setDraft(r.id, "type", e.currentTarget.value)}
              className="rounded-md border bg-background px-2 py-1 text-xs"
            >
              <option value="project">project</option>
              <option value="account">account</option>
              <option value="person">person</option>
              <option value="user_merge">user_merge</option>
            </select>
            <Input
              type="text"
              aria-label={`Entity id for ${r.amie_id}`}
              placeholder="BIO130001"
              value={draft.id}
              onChange={(e) => setDraft(r.id, "id", e.currentTarget.value)}
              className="w-40"
            />
            <Button type="submit" variant="outline" size="sm" disabled={!draft.id.trim()}>
              Link
            </Button>
          </form>
        );
      },
    },
    {
      key: "skip",
      header: "Or skip…",
      align: "right",
      cell: (r) => (
        <form
          className="flex items-end justify-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const reason = (skipDraft[r.id] ?? "").trim();
            if (reason.length < 3) return;
            onSkip(r, reason);
            setSkipDraft((prev) => ({ ...prev, [r.id]: "" }));
          }}
        >
          <Input
            type="text"
            aria-label={`Skip reason for ${r.amie_id}`}
            placeholder="reason (≥3 chars)"
            value={skipDraft[r.id] ?? ""}
            onChange={(e) => setSkipDraft((prev) => ({ ...prev, [r.id]: e.currentTarget.value }))}
            className="w-44"
          />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={(skipDraft[r.id] ?? "").trim().length < 3}
          >
            Skip
          </Button>
        </form>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Decoded packets that couldn't be auto-linked to a domain entity.
          </p>
          <Label className="text-xs text-muted-foreground">{total} unmapped</Label>
        </div>
      </div>

      {error ? (
        <ErrorState message={error.message ?? "Failed to load queue"} onRetry={onRefresh} />
      ) : isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <EmptyState
          heading="Inbox clean"
          description="Every decoded packet is mapped to a domain entity."
        />
      ) : (
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />
      )}
    </div>
  );
}
