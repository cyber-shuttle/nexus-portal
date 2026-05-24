import { afterEach, describe, expect, it, vi } from "vitest";
import {
  commitImageToRepo,
  createIssue,
  getAuthedUserLogin,
  GithubAuthError,
  GithubNetworkError,
  GithubNotFoundError,
  GithubServerError,
  GithubValidationError,
} from "../githubClient";

const CFG = { token: "t_test_token_xxxxxxxxxxxxxxxx", repo: "owner/repo" };

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...(headers ?? {}) },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("commitImageToRepo", () => {
  it("returns rawUrl + sha on 201", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(201, {
        content: { download_url: "https://raw.example/x.png", sha: "abc123" },
      }),
    );
    const out = await commitImageToRepo(CFG, "BASE64DATA", "x.png", "msg");
    expect(out).toEqual({ rawUrl: "https://raw.example/x.png", sha: "abc123" });
    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) throw new Error("fetch was not called");
    const [url, init] = firstCall;
    expect(String(url)).toBe(
      "https://api.github.com/repos/owner/repo/contents/.github/feedback-images/x.png",
    );
    expect(init?.method).toBe("PUT");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${CFG.token}`);
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ message: "msg", content: "BASE64DATA" });
  });

  it("throws GithubAuthError on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(401, { message: "Bad credentials" }),
    );
    await expect(commitImageToRepo(CFG, "x", "x.png", "m")).rejects.toBeInstanceOf(GithubAuthError);
  });

  it("throws GithubAuthError on 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(403, { message: "Forbidden" }));
    await expect(commitImageToRepo(CFG, "x", "x.png", "m")).rejects.toBeInstanceOf(GithubAuthError);
  });

  it("throws GithubNotFoundError on 404", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(404, { message: "Not Found" }));
    await expect(commitImageToRepo(CFG, "x", "x.png", "m")).rejects.toBeInstanceOf(
      GithubNotFoundError,
    );
  });

  it("throws GithubServerError on 502", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(502, { message: "Bad Gateway" }));
    await expect(commitImageToRepo(CFG, "x", "x.png", "m")).rejects.toBeInstanceOf(
      GithubServerError,
    );
  });

  it("wraps fetch rejection as GithubNetworkError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("connection refused"));
    await expect(commitImageToRepo(CFG, "x", "x.png", "m")).rejects.toBeInstanceOf(
      GithubNetworkError,
    );
  });
});

describe("createIssue", () => {
  it("returns issueUrl + issueNumber on 201", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(201, {
        number: 42,
        html_url: "https://github.com/owner/repo/issues/42",
      }),
    );
    const out = await createIssue(CFG, {
      title: "Suggestion: hello",
      body: "body",
      labels: ["suggestion"],
    });
    expect(out).toEqual({ issueUrl: "https://github.com/owner/repo/issues/42", issueNumber: 42 });
    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) throw new Error("fetch was not called");
    const [url, init] = firstCall;
    expect(String(url)).toBe("https://api.github.com/repos/owner/repo/issues");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ title: "Suggestion: hello", body: "body", labels: ["suggestion"] });
  });

  it("throws GithubValidationError on 422 preserving the message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(422, { message: "Label does not exist" }),
    );
    await expect(
      createIssue(CFG, { title: "t", body: "b", labels: ["nope"] }),
    ).rejects.toMatchObject({
      name: "GithubValidationError",
      message: "Label does not exist",
    });
  });

  it("throws GithubAuthError on 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(401, { message: "Bad credentials" }),
    );
    await expect(createIssue(CFG, { title: "t", body: "b", labels: [] })).rejects.toBeInstanceOf(
      GithubAuthError,
    );
  });

  it("throws GithubServerError on 500", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(500, { message: "boom" }));
    await expect(createIssue(CFG, { title: "t", body: "b", labels: [] })).rejects.toBeInstanceOf(
      GithubServerError,
    );
  });

  it("wraps fetch rejection as GithubNetworkError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(createIssue(CFG, { title: "t", body: "b", labels: [] })).rejects.toBeInstanceOf(
      GithubNetworkError,
    );
  });
});

describe("getAuthedUserLogin", () => {
  it("returns the login on 200", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse(200, { login: "octocat", id: 1 }));
    const login = await getAuthedUserLogin("tkn");
    expect(login).toBe("octocat");
    const firstCall = fetchSpy.mock.calls[0];
    if (!firstCall) throw new Error("fetch was not called");
    const [url, init] = firstCall;
    expect(String(url)).toBe("https://api.github.com/user");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tkn");
  });

  it("returns null on non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(401, { message: "bad" }));
    expect(await getAuthedUserLogin("tkn")).toBeNull();
  });

  it("returns null on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    expect(await getAuthedUserLogin("tkn")).toBeNull();
  });

  it("returns null when login field is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse(200, { id: 1 }));
    expect(await getAuthedUserLogin("tkn")).toBeNull();
  });
});
