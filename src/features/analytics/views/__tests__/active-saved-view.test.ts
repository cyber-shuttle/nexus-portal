import { describe, expect, it } from "vitest";
import { activeSavedViewId } from "../components/SavedViewsToolbar";
import type { SavedView } from "../types";

const VIEW_30D: SavedView = {
  id: "view-30",
  user_id: "researcher@nexus.local",
  name: "Last 30 days",
  persona: "researcher",
  range: { from: "2026-04-22T00:00:00Z", to: "2026-05-22T00:00:00Z", preset: "30d" },
  group_by: ["resource", "all"],
  filters: {},
  is_default: false,
  created_at: "2026-05-22T00:00:00Z",
  updated_at: "2026-05-22T00:00:00Z",
};

const VIEW_7D: SavedView = {
  id: "view-7",
  user_id: "researcher@nexus.local",
  name: "Weekly",
  persona: "researcher",
  range: { from: "2026-05-15T00:00:00Z", to: "2026-05-22T00:00:00Z", preset: "7d" },
  group_by: ["project", "all"],
  filters: {},
  is_default: true,
  created_at: "2026-05-22T00:00:00Z",
  updated_at: "2026-05-22T00:00:00Z",
};

const RANGE_30D = {
  from: new Date("2026-04-22T00:00:00Z"),
  to: new Date("2026-05-22T00:00:00Z"),
  preset: "30d" as const,
};

describe("activeSavedViewId", () => {
  it("matches the view whose preset and group-by align with the URL", () => {
    const id = activeSavedViewId({
      views: [VIEW_30D, VIEW_7D],
      searchParams: new URLSearchParams("preset=30d&gb=resource"),
      range: RANGE_30D,
      groupBy: ["resource", "all"],
    });
    expect(id).toBe("view-30");
  });

  it("returns null when the URL preset matches but the group-by drifted", () => {
    const id = activeSavedViewId({
      views: [VIEW_30D, VIEW_7D],
      searchParams: new URLSearchParams("preset=30d&gb=project"),
      range: RANGE_30D,
      groupBy: ["project", "all"],
    });
    expect(id).toBeNull();
  });

  it("returns null when the user changes the date range after applying a view", () => {
    const id = activeSavedViewId({
      views: [VIEW_7D],
      searchParams: new URLSearchParams("preset=30d&gb=project"),
      range: RANGE_30D,
      groupBy: ["project", "all"],
    });
    expect(id).toBeNull();
  });

  it("treats trailing 'all' slots as a no-op so 2-slot views still match 3-slot pages", () => {
    const view3slot: SavedView = {
      ...VIEW_30D,
      id: "view-3slot",
      group_by: ["resource", "all", "all"],
    };
    const id = activeSavedViewId({
      views: [view3slot],
      searchParams: new URLSearchParams("preset=30d&gb=resource"),
      range: RANGE_30D,
      groupBy: ["resource", "all", "all"],
    });
    expect(id).toBe("view-3slot");
  });

  it("matches a custom-range view on absolute ISO endpoints", () => {
    const custom: SavedView = {
      ...VIEW_30D,
      id: "view-custom",
      range: {
        from: "2026-05-01T00:00:00Z",
        to: "2026-05-10T00:00:00Z",
        preset: "custom",
      },
    };
    const id = activeSavedViewId({
      views: [custom],
      searchParams: new URLSearchParams(
        `preset=custom&from=${encodeURIComponent(custom.range.from)}&to=${encodeURIComponent(
          custom.range.to,
        )}&gb=resource`,
      ),
      range: {
        from: new Date(custom.range.from),
        to: new Date(custom.range.to),
        preset: "custom",
      },
      groupBy: ["resource", "all"],
    });
    expect(id).toBe("view-custom");
  });
});
