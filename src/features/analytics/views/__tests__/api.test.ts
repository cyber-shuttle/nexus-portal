import { ApiError } from "@shared/api/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSavedView,
  deleteSavedView,
  getSavedViews,
  updateSavedView,
} from "../api";
import {
  createSavedViewPayloadSchema,
  savedViewListSchema,
  savedViewSchema,
  updateSavedViewPayloadSchema,
} from "../schemas";
import type { CreateSavedViewPayload, SavedView } from "../types";

const SAMPLE_VIEW: SavedView = {
  id: "view-1",
  user_id: "researcher@nexus.local",
  name: "Last 7 days",
  persona: "researcher",
  range: {
    from: "2026-05-01T00:00:00Z",
    to: "2026-05-08T00:00:00Z",
    preset: "7d",
  },
  group_by: ["resource", "all"],
  filters: {},
  is_default: true,
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

function mockJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("saved-views schemas", () => {
  it("accepts a well-formed SavedView", () => {
    expect(() => savedViewSchema.parse(SAMPLE_VIEW)).not.toThrow();
  });

  it("rejects a SavedView with empty name", () => {
    const bad = { ...SAMPLE_VIEW, name: "" };
    expect(savedViewSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects a SavedView with bogus persona", () => {
    const bad = { ...SAMPLE_VIEW, persona: "viewer" };
    expect(savedViewSchema.safeParse(bad).success).toBe(false);
  });

  it("accepts a list of SavedViews", () => {
    expect(() => savedViewListSchema.parse([SAMPLE_VIEW])).not.toThrow();
  });

  it("rejects a create payload missing required fields", () => {
    const bad = { name: "x" };
    expect(createSavedViewPayloadSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an update payload with no mutable fields", () => {
    expect(updateSavedViewPayloadSchema.safeParse({}).success).toBe(false);
  });

  it("accepts an update payload with a single field", () => {
    expect(
      updateSavedViewPayloadSchema.safeParse({ is_default: true }).success,
    ).toBe(true);
  });
});

describe("saved-views API fetchers", () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("getSavedViews validates the response and forwards persona + user", async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse([SAMPLE_VIEW]));
    const out = await getSavedViews("researcher", "researcher@nexus.local");
    expect(out).toHaveLength(1);
    const call = fetchSpy.mock.calls[0]?.[0] as string;
    expect(call).toContain("/api/v1/analytics/views?");
    expect(call).toContain("persona=researcher");
    expect(call).toContain("user=researcher%40nexus.local");
  });

  it("getSavedViews surfaces a parse error when the response is malformed", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJsonResponse([{ ...SAMPLE_VIEW, name: "" }]),
    );
    await expect(getSavedViews("researcher", null)).rejects.toThrow();
  });

  it("createSavedView posts the payload + parses the created view", async () => {
    fetchSpy.mockResolvedValueOnce(mockJsonResponse(SAMPLE_VIEW, 201));
    const payload: CreateSavedViewPayload = {
      name: "Last 7 days",
      persona: "researcher",
      range: SAMPLE_VIEW.range,
      group_by: ["resource", "all"],
      is_default: true,
    };
    const created = await createSavedView(payload, "researcher@nexus.local");
    expect(created).toEqual(SAMPLE_VIEW);
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ name: "Last 7 days" });
  });

  it("createSavedView wraps 409 limit responses in ApiError", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJsonResponse({ error: "limit_reached" }, 409),
    );
    const payload: CreateSavedViewPayload = {
      name: "x",
      persona: "researcher",
      range: SAMPLE_VIEW.range,
      group_by: [],
    };
    await expect(createSavedView(payload, null)).rejects.toBeInstanceOf(ApiError);
  });

  it("updateSavedView puts to the per-id route", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockJsonResponse({ ...SAMPLE_VIEW, name: "Weekly" }),
    );
    const next = await updateSavedView(
      "view-1",
      { name: "Weekly" },
      "researcher@nexus.local",
    );
    expect(next.name).toBe("Weekly");
    const url = fetchSpy.mock.calls[0]?.[0] as string;
    expect(url).toContain("/api/v1/analytics/views/view-1");
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("PUT");
  });

  it("deleteSavedView issues a DELETE and resolves on 204", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(deleteSavedView("view-1", null)).resolves.toBeUndefined();
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("DELETE");
  });
});
