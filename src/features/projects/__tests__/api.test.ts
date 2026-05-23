import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createProject,
  getProjectUsageSummary,
  getProjectsForUser,
  listProjects,
  updateProjectStatus,
} from "../api";
import {
  createProjectPayloadSchema,
  projectListEnvelopeSchema,
  projectUsageSummarySchema,
  updateProjectStatusPayloadSchema,
} from "../schemas";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

function mockResponse(status: number, body: unknown): Response {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(text, { status, headers: { "content-type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

const validProject = {
  id: "project-001",
  originated_id: "BIO130000",
  title: "Test Project",
  origination: "ACCESS",
  project_pi_id: "pi@nexus.local",
  status: "ACTIVE" as const,
  created_time: "2026-04-01T00:00:00.000Z",
};

describe("projectListEnvelopeSchema", () => {
  it("accepts a valid envelope", () => {
    expect(
      projectListEnvelopeSchema.safeParse({ items: [validProject], total: 1 }).success,
    ).toBe(true);
  });

  it("rejects a negative total", () => {
    expect(
      projectListEnvelopeSchema.safeParse({ items: [], total: -1 }).success,
    ).toBe(false);
  });
});

describe("createProjectPayloadSchema", () => {
  it("requires title 1+ chars", () => {
    expect(
      createProjectPayloadSchema.safeParse({
        title: "",
        origination: "ACCESS",
        project_pi_id: "pi@nexus.local",
      }).success,
    ).toBe(false);
  });

  it("accepts a complete payload", () => {
    expect(
      createProjectPayloadSchema.safeParse({
        title: "New Project",
        origination: "ACCESS",
        project_pi_id: "pi@nexus.local",
      }).success,
    ).toBe(true);
  });
});

describe("updateProjectStatusPayloadSchema", () => {
  it("rejects an invalid status", () => {
    expect(updateProjectStatusPayloadSchema.safeParse({ status: "FOO" }).success).toBe(false);
  });
  it("accepts ACTIVE/INACTIVE/DELETED", () => {
    expect(updateProjectStatusPayloadSchema.safeParse({ status: "ACTIVE" }).success).toBe(true);
    expect(updateProjectStatusPayloadSchema.safeParse({ status: "DELETED" }).success).toBe(true);
  });
});

describe("listProjects fetcher", () => {
  it("sends paged=1 and round-trips filters", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { items: [validProject], total: 1 }));
    const result = await listProjects({ limit: 20, offset: 0, pi_id: "pi@nexus.local", status: "ACTIVE", q: "test" });
    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("paged=1");
    expect(calledUrl).toContain("limit=20");
    expect(calledUrl).toContain("pi_id=pi%40nexus.local");
    expect(calledUrl).toContain("status=ACTIVE");
    expect(calledUrl).toContain("q=test");
  });

  it("rejects on schema mismatch (total missing)", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, { items: [validProject] }));
    await expect(listProjects()).rejects.toThrow();
  });
});

describe("getProjectsForUser fetcher", () => {
  it("hits /users/{id}/projects and validates the array", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, [validProject]));
    const out = await getProjectsForUser("researcher@nexus.local");
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("project-001");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/users/researcher@nexus.local/projects");
  });

  it("returns [] when backend returns null", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, null));
    const out = await getProjectsForUser("researcher@nexus.local");
    expect(out).toEqual([]);
  });
});

describe("createProject fetcher", () => {
  it("POSTs the validated payload and parses the response", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(200, validProject));
    const out = await createProject({
      title: "New Project",
      origination: "ACCESS",
      project_pi_id: "pi@nexus.local",
    });
    expect(out.id).toBe("project-001");
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe("POST");
  });
});

describe("updateProjectStatus fetcher", () => {
  it("PUTs to /projects/{id}/status", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(200, { ...validProject, status: "INACTIVE" }),
    );
    const out = await updateProjectStatus("project-001", { status: "INACTIVE" });
    expect(out.status).toBe("INACTIVE");
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.method).toBe("PUT");
    expect(fetchMock.mock.calls[0]?.[0]).toContain("/projects/project-001/status");
  });
});

describe("getProjectUsageSummary fetcher", () => {
  it("serializes the range as ?from&to and validates the summary", async () => {
    const summary = {
      project_id: "project-001",
      range: { from: "2026-04-01T00:00:00.000Z", to: "2026-05-01T00:00:00.000Z" },
      total_allocated_su: 1000,
      total_used_su: 250,
      allocations: [
        {
          allocation_id: "alloc-001",
          allocation_name: "BIO-001",
          allocated_su: 1000,
          used_su: 250,
        },
      ],
      by_resource: [
        {
          resource_id: "alloc-001-res-1",
          resource_name: "cpu-standard",
          resource_type: "cpu",
          used_su: 250,
          used_pct: 100,
        },
      ],
      by_member: [{ user_id: "u-1", user_label: "Riya R", used_su: 250 }],
    };
    fetchMock.mockResolvedValueOnce(mockResponse(200, summary));
    const out = await getProjectUsageSummary("project-001", {
      from: "2026-04-01T00:00:00.000Z",
      to: "2026-05-01T00:00:00.000Z",
    });
    expect(out.total_used_su).toBe(250);
    expect(projectUsageSummarySchema.safeParse(out).success).toBe(true);
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("from=2026-04-01T00%3A00%3A00.000Z");
    expect(calledUrl).toContain("to=2026-05-01T00%3A00%3A00.000Z");
  });
});
