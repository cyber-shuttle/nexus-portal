import { findOverlappingRate } from "@mocks/handlers/admin";
import { describe, expect, it } from "vitest";

// Spec §11 Phase 7 — non-overlapping rate windows. Documented in
// docs/backend-contracts/admin.md (409 rate_overlaps_existing).
// Half-open [effective_from, effective_to): touching boundaries do not overlap.

const RESOURCE_ID = "alloc-001-res-1";

function row(id: string, start_time: string, end_time: string) {
  return {
    id,
    compute_allocation_resource_id: RESOURCE_ID,
    start_time,
    end_time,
  };
}

describe("findOverlappingRate", () => {
  it("flags two creates with identical windows as a conflict", () => {
    const existing = [row("rate-1", "2027-01-01T00:00:00Z", "2027-12-31T23:59:59Z")];
    const conflict = findOverlappingRate(existing, {
      compute_allocation_resource_id: RESOURCE_ID,
      effective_from: "2027-01-01T00:00:00Z",
      effective_to: "2027-12-31T23:59:59Z",
    });
    expect(conflict?.id).toBe("rate-1");
  });

  it("flags a partially overlapping window", () => {
    const existing = [row("rate-1", "2027-01-01T00:00:00Z", "2027-06-30T23:59:59Z")];
    const conflict = findOverlappingRate(existing, {
      compute_allocation_resource_id: RESOURCE_ID,
      effective_from: "2027-06-01T00:00:00Z",
      effective_to: "2027-12-31T23:59:59Z",
    });
    expect(conflict?.id).toBe("rate-1");
  });

  it("accepts an immediately adjacent window (end == new start)", () => {
    const existing = [row("rate-1", "2027-01-01T00:00:00Z", "2027-06-30T00:00:00Z")];
    const conflict = findOverlappingRate(existing, {
      compute_allocation_resource_id: RESOURCE_ID,
      effective_from: "2027-06-30T00:00:00Z",
      effective_to: "2027-12-31T23:59:59Z",
    });
    expect(conflict).toBeUndefined();
  });

  it("ignores rates on a different resource id", () => {
    const existing = [
      {
        id: "rate-1",
        compute_allocation_resource_id: "other-resource",
        start_time: "2027-01-01T00:00:00Z",
        end_time: "2027-12-31T23:59:59Z",
      },
    ];
    const conflict = findOverlappingRate(existing, {
      compute_allocation_resource_id: RESOURCE_ID,
      effective_from: "2027-01-01T00:00:00Z",
      effective_to: "2027-12-31T23:59:59Z",
    });
    expect(conflict).toBeUndefined();
  });

  it("flags an envelope window that fully contains the new one", () => {
    const existing = [row("rate-1", "2026-01-01T00:00:00Z", "2028-01-01T00:00:00Z")];
    const conflict = findOverlappingRate(existing, {
      compute_allocation_resource_id: RESOURCE_ID,
      effective_from: "2027-03-01T00:00:00Z",
      effective_to: "2027-04-01T00:00:00Z",
    });
    expect(conflict?.id).toBe("rate-1");
  });

  it("returns undefined when no existing rate matches the resource", () => {
    const conflict = findOverlappingRate([], {
      compute_allocation_resource_id: RESOURCE_ID,
      effective_from: "2027-01-01T00:00:00Z",
      effective_to: "2027-12-31T23:59:59Z",
    });
    expect(conflict).toBeUndefined();
  });
});
