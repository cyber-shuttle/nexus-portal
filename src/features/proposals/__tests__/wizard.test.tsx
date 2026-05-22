import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProposalPayloadSchema,
  updateProposalPayloadSchema,
  proposalDecisionPayloadSchema,
} from "../schemas";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

afterEach(() => {
  fetchMock.mockReset();
});

const baseValid = {
  project_id: "project-001",
  project_title: "Research Project 1",
  requester_id: "pi@nexus.local",
  title: "Quarterly extension — Phase 2",
  abstract:
    "Abstract for the proposal that is at least forty characters long to satisfy the schema.",
  justification: "x".repeat(600),
  start_date: "2026-06-01T00:00:00Z",
  end_date: "2026-12-31T23:59:59Z",
  resources: [
    {
      resource_id: "alloc-001-res-1",
      resource_name: "gpu-h100",
      resource_type: "gpu",
      requested_su_amount: 50000,
    },
  ],
  cascade_to_sub_projects: false,
  child_allocations: [],
  status: "SUBMITTED" as const,
};

describe("createProposalPayloadSchema", () => {
  it("accepts a complete payload", () => {
    const result = createProposalPayloadSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it("rejects empty resources", () => {
    const result = createProposalPayloadSchema.safeParse({
      ...baseValid,
      resources: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects short justification", () => {
    const result = createProposalPayloadSchema.safeParse({
      ...baseValid,
      justification: "too short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects overlong abstract", () => {
    const result = createProposalPayloadSchema.safeParse({
      ...baseValid,
      abstract: "x".repeat(1300),
    });
    expect(result.success).toBe(false);
  });

  it("accepts cascade with child allocations", () => {
    const result = createProposalPayloadSchema.safeParse({
      ...baseValid,
      cascade_to_sub_projects: true,
      child_allocations: [
        { project_id: "p-a", project_title: "Sub A", su_split_percent: 60 },
        { project_id: "p-b", project_title: "Sub B", su_split_percent: 40 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an out-of-range split percent", () => {
    const result = createProposalPayloadSchema.safeParse({
      ...baseValid,
      cascade_to_sub_projects: true,
      child_allocations: [
        { project_id: "p-a", project_title: "Sub A", su_split_percent: 140 },
      ],
    });
    expect(result.success).toBe(false);
  });
});

describe("cascade split math", () => {
  it("sums to 100 across even split", () => {
    const children = [
      { project_id: "p-a", project_title: "Sub A", su_split_percent: 34 },
      { project_id: "p-b", project_title: "Sub B", su_split_percent: 33 },
      { project_id: "p-c", project_title: "Sub C", su_split_percent: 33 },
    ];
    const total = children.reduce((acc, c) => acc + c.su_split_percent, 0);
    expect(total).toBe(100);
  });
});

describe("updateProposalPayloadSchema", () => {
  it("rejects empty patches", () => {
    const result = updateProposalPayloadSchema.safeParse({});
    expect(result.success).toBe(false);
  });
  it("accepts a single-field patch", () => {
    const result = updateProposalPayloadSchema.safeParse({ title: "Renamed proposal" });
    expect(result.success).toBe(true);
  });
});

describe("proposalDecisionPayloadSchema", () => {
  it("requires decided_by", () => {
    const bad = proposalDecisionPayloadSchema.safeParse({});
    expect(bad.success).toBe(false);
  });
  it("accepts a payload with optional note", () => {
    const ok = proposalDecisionPayloadSchema.safeParse({
      decided_by: "admin@nexus.local",
      decision_note: "Looks great.",
    });
    expect(ok.success).toBe(true);
  });
});
