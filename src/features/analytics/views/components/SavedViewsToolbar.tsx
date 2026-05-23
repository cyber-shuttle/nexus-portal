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

  const handleApply = React.useCallback(
    (view: SavedView) => {
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
    writeViewToUrl(defaultView);
    onApply?.(defaultView);
  }, [viewsQuery.isLoading, hasUrlState, defaultView, writeViewToUrl, onApply]);

  // Derive the active chip from URL state so the press indicator only lights
  // the chip whose snapshot still matches what's applied. The moment the user
  // tweaks the range or a group-by chip the press goes away — there's no
  // longer a "saved view" applied, just a manual edit. (A6 polish.)
  const activeId = React.useMemo(
    () =>
      activeSavedViewId({
        views,
        searchParams,
        range,
        groupBy,
      }),
    [views, searchParams, range, groupBy],
  );

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

type ActiveLookup = {
  views: SavedView[];
  searchParams: URLSearchParams | ReadonlyURLSearchParams;
  range: AnalyticsRange;
  groupBy: string[];
};

// Compares each saved view's snapshot to the current URL state and returns
// the id of the matching view, or null when nothing matches. We compare
// preset names first (the common case for chip applies) and fall back to ISO
// `from`/`to` for custom windows. Group-by arrays must match positionally —
// trailing "all" slots are normalized away so a view saved with two slots
// still matches when the page renders three.
export function activeSavedViewId({
  views,
  searchParams,
  range,
  groupBy,
}: ActiveLookup): string | null {
  const urlPreset = searchParams.get("preset");
  const urlGroupBy = trimTrailingAll(parseGroupByParam(searchParams.get("gb")));
  for (const view of views) {
    if (!groupByMatches(urlGroupBy, view.group_by, groupBy)) continue;
    if (!rangeMatches(view, urlPreset, range)) continue;
    return view.id;
  }
  return null;
}

type ReadonlyURLSearchParams = {
  get(name: string): string | null;
};

function parseGroupByParam(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim());
}

function trimTrailingAll(slots: string[]): string[] {
  const out = slots.slice();
  while (out.length > 0 && out[out.length - 1] === "all") out.pop();
  return out;
}

function groupByMatches(
  urlGroupBy: string[],
  viewGroupBy: string[],
  currentGroupBy: string[],
): boolean {
  // Prefer URL-derived slots; fall back to the container-resolved values when
  // the URL has no `?gb=` (default-on-load path before the auto-apply landed).
  const left = urlGroupBy.length > 0 ? urlGroupBy : trimTrailingAll(currentGroupBy);
  const right = trimTrailingAll(viewGroupBy);
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function rangeMatches(
  view: SavedView,
  urlPreset: string | null,
  currentRange: AnalyticsRange,
): boolean {
  // Preset views: match on preset name. `currentRange.preset` already reflects
  // either the URL value or the default fallback, so we can use it directly.
  if (view.range.preset && view.range.preset !== "custom") {
    const effectivePreset = urlPreset ?? currentRange.preset;
    return effectivePreset === view.range.preset;
  }
  // Custom views: match on absolute ISO endpoints. We compare millis so
  // equivalent ISO strings (with/without ms) still match.
  if (view.range.preset === "custom" || !view.range.preset) {
    if (currentRange.preset !== "custom") return false;
    const viewFrom = Date.parse(view.range.from);
    const viewTo = Date.parse(view.range.to);
    if (Number.isNaN(viewFrom) || Number.isNaN(viewTo)) return false;
    return (
      viewFrom === currentRange.from.getTime() &&
      viewTo === currentRange.to.getTime()
    );
  }
  return false;
}
