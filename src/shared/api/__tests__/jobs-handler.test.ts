import { jobListSchema, queueWaitTimeListSchema } from "@features/analytics/schemas";
import { jobsHandlers } from "@mocks/handlers/jobs";
import { describe, expect, it } from "vitest";

// Invoke each MSW handler's resolver directly so the test asserts the
// response shape without booting setupServer + global fetch. Covers the spec
// §11 "MSW handler returns shape that matches Zod schema" objective.

type HandlerEntry = (typeof jobsHandlers)[number] & {
  resolver: (ctx: { request: Request; params: Record<string, string>; cookies: Record<string, string> }) => Promise<Response> | Response;
};

const jobsHandler = jobsHandlers[0] as HandlerEntry;
const waitHandler = jobsHandlers[1] as HandlerEntry;

async function callResolver(handler: HandlerEntry, url: string): Promise<Response> {
  const result = await handler.resolver({
    request: new Request(url),
    params: {},
    cookies: {},
  });
  if (!result) throw new Error("handler did not respond");
  return result;
}

describe("jobs MSW handler", () => {
  it("returns a Zod-valid `Job[]` array filtered by user_id", async () => {
    const response = await callResolver(
      jobsHandler,
      "http://localhost/api/v1/jobs?user_id=researcher@nexus.local&limit=10",
    );
    expect(response.status).toBe(200);
    const parsed = jobListSchema.parse(await response.json());
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.length).toBeLessThanOrEqual(10);
    for (const job of parsed) {
      expect(job.user_id).toBe("researcher@nexus.local");
    }
  });

  it("filters by from/to window", async () => {
    const from = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const response = await callResolver(
      jobsHandler,
      `http://localhost/api/v1/jobs?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=50`,
    );
    expect(response.status).toBe(200);
    const body = jobListSchema.parse(await response.json());
    for (const job of body) {
      const t = Date.parse(job.started_at);
      expect(t).toBeGreaterThanOrEqual(Date.parse(from));
      expect(t).toBeLessThanOrEqual(Date.parse(to));
    }
  });
});

describe("queues/wait-time MSW handler", () => {
  it("returns a Zod-valid `QueueWaitTime[]` array", async () => {
    const response = await callResolver(
      waitHandler,
      "http://localhost/api/v1/queues/wait-time?group_by=queue",
    );
    expect(response.status).toBe(200);
    const parsed = queueWaitTimeListSchema.parse(await response.json());
    expect(parsed.length).toBeGreaterThan(0);
    for (const wt of parsed) {
      expect(wt.p90).toBeGreaterThanOrEqual(wt.p50);
    }
  });
});
