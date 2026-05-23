"use client";

import type { AnalyticsPersona } from "@shared/auth/personaForAnalytics";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { toast } from "sonner";
import { applyGroupByToParams } from "@/shared/hooks/useUrlGroupBy";
import { applyRangeToParams, type AnalyticsRange } from "@/shared/hooks/useUrlRange";
import {
  useCreateSavedView,
  useDeleteSavedView,
  useSavedViews,
  useUpdateSavedView,
} from "../queries";
import type { CreateSavedViewPayload, SavedView } from "../types";
import { SaveViewPopover } from "./SaveViewPopover";
import { SavedViewChips } from "./SavedViewChips";

export type SavedViewsToolbarProps = {
  persona: AnalyticsPersona;
  userId: string | null;
  range: AnalyticsRange;
  groupBy: string[];
  // Optional hook for callers that want to react to an apply (e.g. logging
  // or extra side effects). The URL write is done by the toolbar itself so
  // range + groupBy land atomically.
  onApply?: (view: SavedView) => void;
};

export type SavedViewsToolbarSlots = {
  chips: React.ReactNode;
  trigger: React.ReactNode;
  defaultView: SavedView | null;
  isLoaded: boolean;
};

// Composes the saved-views row for any persona page. Returns two slot nodes
// (chips + trigger) so the container can drop them into the existing
// MetaRow layout in whatever order the spec calls for (spec §6.1/6.2/6.3).
export function useSavedViewsToolbar({
  persona,
  userId,
  range,
  groupBy,
  onApply,
}: SavedViewsToolbarProps): SavedViewsToolbarSlots {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewsQuery = useSavedViews(persona, userId, { enabled: Boolean(userId) });
  const createMutation = useCreateSavedView(persona, userId);
  const updateMutation = useUpdateSavedView(persona, userId);
  const deleteMutation = useDeleteSavedView(persona, userId);

  const views = viewsQuery.data ?? [];
  const defaultView = views.find((v) => v.is_default) ?? null;

  // Atomic URL write: setRange + setGroupBy via separate hooks would each
  // start from the same `searchParams` snapshot and the second writer would
  // clobber the first. We compose both keys into one URLSearchParams and
  // issue a single router.replace so range + group_by land together.
  const writeViewToUrl = React.useCallback(
    (view: SavedView) => {
      const fromMs = Date.parse(view.range.from);
      const toMs = Date.parse(view.range.to);
      let params = new URLSearchParams(searchParams.toString());
      if (!Number.isNaN(fromMs) && !Number.isNaN(toMs)) {
        params = applyRangeToParams(params, {
          from: new Date(fromMs),
          to: new Date(toMs),
          preset: view.range.preset,
        });
      }
      params = applyGroupByToParams(params, view.group_by);
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router, searchParams],
  );

  const buildPayload = React.useCallback(
    (form: { name: string; is_default: boolean }): CreateSavedViewPayload => ({
      name: form.name,
      persona,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        preset: range.preset,
      },
      group_by: groupBy,
      filters: {},
      is_default: form.is_default,
    }),
    [persona, range.from, range.to, range.preset, groupBy],
  );

  const onCreate = React.useCallback(
    async (payload: CreateSavedViewPayload) => {
      const created = await createMutation.mutateAsync(payload);
      toast.success(`Saved “${created.name}”`);
    },
    [createMutation],
  );

  const onDelete = React.useCallback(
    (view: SavedView) => {
      deleteMutation.mutate(view.id, {
        onSuccess: () => toast.success(`Deleted “${view.name}”`),
        onError: (err) => toast.error(err.message ?? "Failed to delete view"),
      });
    },
    [deleteMutation],
  );

  const onSetDefault = React.useCallback(
    (view: SavedView) => {
      updateMutation.mutate(
        { id: view.id, payload: { is_default: !view.is_default } },
        {
          onSuccess: (next) =>
            toast.success(
              next.is_default ? `Pinned “${next.name}” as default` : "Cleared default",
            ),
          onError: (err) => toast.error(err.message ?? "Failed to update view"),
        },
      );
    },
    [updateMutation],
  );

  // Apply-time chip; the active id is purely visual — we don't echo it
  // through URL state because the user can edit range/groupBy after apply.
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const handleApply = React.useCallback(
    (view: SavedView) => {
      setActiveId(view.id);
      writeViewToUrl(view);
      onApply?.(view);
    },
    [writeViewToUrl, onApply],
  );

  // Auto-apply the default view on a fresh navigation (spec §9 Phase A4).
  // "Fresh" = the URL has none of the analytics state params (`preset`,
  // `from`, `to`, `gb`). We gate on a ref so the apply only happens once
  // per mount even when the view list refetches.
  const hasUrlState = React.useMemo(() => {
    return (
      searchParams.has("preset") ||
      searchParams.has("from") ||
      searchParams.has("to") ||
      searchParams.has("gb")
    );
  }, [searchParams]);
  const autoAppliedRef = React.useRef(false);
  React.useEffect(() => {
    if (autoAppliedRef.current) return;
    if (viewsQuery.isLoading) return;
    if (hasUrlState) {
      autoAppliedRef.current = true;
      return;
    }
    if (!defaultView) {
      autoAppliedRef.current = true;
      return;
    }
    autoAppliedRef.current = true;
    setActiveId(defaultView.id);
    writeViewToUrl(defaultView);
    onApply?.(defaultView);
  }, [viewsQuery.isLoading, hasUrlState, defaultView, writeViewToUrl, onApply]);

  const chips = (
    <SavedViewChips
      views={views}
      activeId={activeId}
      onApply={handleApply}
      onDelete={onDelete}
      onSetDefault={onSetDefault}
    />
  );

  const trigger = (
    <SaveViewPopover
      buildPayload={buildPayload}
      onCreate={onCreate}
      currentCount={views.length}
      disabled={!userId || viewsQuery.isLoading}
      isSaving={createMutation.isPending}
      errorMessage={createMutation.error?.message ?? null}
    />
  );

  return {
    chips,
    trigger,
    defaultView,
    isLoaded: !viewsQuery.isLoading,
  };
}
