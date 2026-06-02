import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const commitImageToRepoMock = vi.hoisted(() => vi.fn());
const createIssueMock = vi.hoisted(() => vi.fn());
const getAuthedUserLoginMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/auth/auth", () => ({ auth: authMock }));
vi.mock("@/features/feedback/githubClient", async () => {
  const actual = await vi.importActual<typeof import("@/features/feedback/githubClient")>(
    "@/features/feedback/githubClient",
  );
  return {
    ...actual,
    commitImageToRepo: commitImageToRepoMock,
    createIssue: createIssueMock,
    getAuthedUserLogin: getAuthedUserLoginMock,
  };
});

async function postFeedback(body: Record<string, unknown>) {
  const { POST } = await import("../route");
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost/api/feedback", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(req);
}

const VALID_PAYLOAD = {
  comment: "this is a long enough comment to satisfy zod",
  context: {
    route: "/projects",
    persona: "user",
    reporterEmail: "client-supplied@example.org",
    viewport: { w: 1280, h: 800 },
    userAgent: "vitest",
    buildSha: "test",
    timestamp: new Date().toISOString(),
    consoleErrors: [],
    componentOutline: {
      pageTitle: "",
      headings: [],
      navActive: "",
      navSiblings: [],
      primaryButtons: [],
      slots: [],
    },
  },
};

beforeEach(() => {
  createIssueMock.mockResolvedValue({ issueUrl: "https://github.com/x/y/issues/42", issueNumber: 42 });
  commitImageToRepoMock.mockResolvedValue({ rawUrl: "https://raw.example/img.png", sha: "abc" });
  getAuthedUserLoginMock.mockResolvedValue("octocat");
});

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/feedback — token selection", () => {
  it("uses the user's GitHub access token when session.provider === 'github'", async () => {
    authMock.mockResolvedValue({
      user: { email: "researcher@nexus.local" },
      provider: "github",
      accessToken: "user-github-token",
    });
    vi.stubEnv("FEEDBACK_GITHUB_TOKEN", "bot-pat-fallback-xxxxxxxxxx");

    const res = await postFeedback(VALID_PAYLOAD);

    expect(res.status).toBe(200);
    expect(createIssueMock).toHaveBeenCalledOnce();
    const cfgArg = createIssueMock.mock.calls[0]?.[0] as { token: string };
    expect(cfgArg.token).toBe("user-github-token");
    expect(cfgArg.token).not.toContain("bot-pat");
  });

  it("falls back to FEEDBACK_GITHUB_TOKEN when session has no github token", async () => {
    authMock.mockResolvedValue({
      user: { email: "researcher@nexus.local" },
      provider: "credentials",
    });
    vi.stubEnv("FEEDBACK_GITHUB_TOKEN", "bot-pat-fallback-xxxxxxxxxx");

    const res = await postFeedback(VALID_PAYLOAD);

    expect(res.status).toBe(200);
    const cfgArg = createIssueMock.mock.calls[0]?.[0] as { token: string };
    expect(cfgArg.token).toBe("bot-pat-fallback-xxxxxxxxxx");
  });

  it("rejects unauthenticated requests with 401", async () => {
    authMock.mockResolvedValue(null);

    const res = await postFeedback(VALID_PAYLOAD);

    expect(res.status).toBe(401);
    expect(createIssueMock).not.toHaveBeenCalled();
  });

  it("stamps reporterEmail from the session and never leaks any email into the issue body", async () => {
    authMock.mockResolvedValue({
      user: { email: "real@nexus.local" },
      provider: "github",
      accessToken: "user-github-token",
    });

    await postFeedback({
      ...VALID_PAYLOAD,
      context: { ...VALID_PAYLOAD.context, reporterEmail: "spoofed@evil.org" },
    });

    // Repo is public; the issue body intentionally omits the email entirely.
    // Attribution comes from the GitHub handle, not the email.
    const issueArg = createIssueMock.mock.calls[0]?.[1] as { body: string };
    expect(issueArg.body).not.toContain("real@nexus.local");
    expect(issueArg.body).not.toContain("spoofed@evil.org");
    expect(issueArg.body).not.toContain("mailto:");
  });

  it("always uses the bot PAT for the image commit, even when a user token is present", async () => {
    authMock.mockResolvedValue({
      user: { email: "researcher@nexus.local" },
      provider: "github",
      accessToken: "user-github-token",
    });
    // serverEnv is parsed at module load; the FEEDBACK_GITHUB_TOKEN cached
    // from the first test in this file is what the route actually sees.
    vi.stubEnv("FEEDBACK_GITHUB_TOKEN", "bot-pat-fallback-xxxxxxxxxx");

    await postFeedback({
      ...VALID_PAYLOAD,
      imagePngBase64: "x".repeat(200),
    });

    expect(commitImageToRepoMock).toHaveBeenCalledOnce();
    const imageCfg = commitImageToRepoMock.mock.calls[0]?.[0] as { token: string };
    expect(imageCfg.token).toBe("bot-pat-fallback-xxxxxxxxxx");
    // Issue still attributed to the user
    const issueCfg = createIssueMock.mock.calls[0]?.[0] as { token: string };
    expect(issueCfg.token).toBe("user-github-token");
  });

  it("files the issue without a screenshot if the image commit throws", async () => {
    authMock.mockResolvedValue({
      user: { email: "researcher@nexus.local" },
      provider: "github",
      accessToken: "user-github-token",
    });
    vi.stubEnv("FEEDBACK_GITHUB_TOKEN", "bot-pat-fallback-xxxxxxxxxx");
    commitImageToRepoMock.mockRejectedValueOnce(new Error("upload boom"));

    const res = await postFeedback({
      ...VALID_PAYLOAD,
      imagePngBase64: "x".repeat(200),
    });

    expect(res.status).toBe(200);
    expect(createIssueMock).toHaveBeenCalledOnce();
    const issueArg = createIssueMock.mock.calls[0]?.[1] as { body: string };
    // Body should not reference a screenshot URL since upload failed
    expect(issueArg.body).not.toMatch(/raw\.example/);
  });
});
