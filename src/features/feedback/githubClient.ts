import "server-only";

export type GithubClientConfig = { token: string; repo: string };

export type CommitImageResult = { rawUrl: string; sha: string };

export type CreateIssueInput = {
  title: string;
  body: string;
  labels: string[];
};

export type CreateIssueResult = {
  issueUrl: string;
  issueNumber: number;
};

export type GithubErrorKind =
  | "auth"
  | "not_found"
  | "validation"
  | "rate_limit"
  | "server"
  | "network";

export class GithubError extends Error {
  kind: GithubErrorKind;
  status?: number;
  constructor(kind: GithubErrorKind, message: string, status?: number) {
    super(message);
    this.name = "GithubError";
    this.kind = kind;
    this.status = status;
  }
}

export class GithubAuthError extends GithubError {
  constructor(message: string, status: number) {
    super("auth", message, status);
    this.name = "GithubAuthError";
  }
}
export class GithubNotFoundError extends GithubError {
  constructor(message: string) {
    super("not_found", message, 404);
    this.name = "GithubNotFoundError";
  }
}
export class GithubValidationError extends GithubError {
  constructor(message: string) {
    super("validation", message, 422);
    this.name = "GithubValidationError";
  }
}
export class GithubRateLimitError extends GithubError {
  retryAfterSeconds?: number;
  constructor(message: string, retryAfterSeconds?: number) {
    super("rate_limit", message, 429);
    this.name = "GithubRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
export class GithubServerError extends GithubError {
  constructor(message: string, status: number) {
    super("server", message, status);
    this.name = "GithubServerError";
  }
}
export class GithubNetworkError extends GithubError {
  constructor(message: string) {
    super("network", message);
    this.name = "GithubNetworkError";
  }
}

const BASE = "https://api.github.com";
const HEADERS_BASE = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "Content-Type": "application/json",
};

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body?.message ?? `GitHub ${res.status}`;
  } catch {
    return `GitHub ${res.status}`;
  }
}

function throwForStatus(res: Response, message: string): never {
  const s = res.status;
  if (s === 401 || s === 403) throw new GithubAuthError(message, s);
  if (s === 404) throw new GithubNotFoundError(message);
  if (s === 422) throw new GithubValidationError(message);
  if (s === 429) {
    const retry = res.headers.get("retry-after");
    const seconds = retry ? Number.parseInt(retry, 10) : undefined;
    throw new GithubRateLimitError(message, Number.isFinite(seconds) ? seconds : undefined);
  }
  if (s >= 500) throw new GithubServerError(message, s);
  throw new GithubError("server", message, s);
}

export async function commitImageToRepo(
  cfg: GithubClientConfig,
  pngBase64: string,
  filename: string,
  commitMessage: string,
  branch?: string,
): Promise<CommitImageResult> {
  const url = `${BASE}/repos/${cfg.repo}/contents/.github/feedback-images/${filename}`;
  // When branch is omitted the Contents API uses the repo's default; passing
  // a name targets a pre-existing branch (the API would otherwise fork one
  // from HEAD, defeating an intended-orphan setup).
  const body: Record<string, unknown> = { message: commitMessage, content: pngBase64 };
  if (branch) body.branch = branch;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "PUT",
      headers: { ...HEADERS_BASE, Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(body),
    });
  } catch (err) {
    throw new GithubNetworkError(err instanceof Error ? err.message : "fetch failed");
  }
  if (res.status !== 201) {
    throwForStatus(res, await readErrorMessage(res));
  }
  const data = (await res.json()) as { content?: { download_url?: string; sha?: string } };
  const rawUrl = data?.content?.download_url;
  const sha = data?.content?.sha;
  if (!rawUrl || !sha) {
    throw new GithubError("server", "GitHub contents response missing download_url/sha", 201);
  }
  return { rawUrl, sha };
}

export async function getAuthedUserLogin(token: string): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/user`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { login?: unknown };
    return typeof data?.login === "string" && data.login.length > 0 ? data.login : null;
  } catch {
    return null;
  }
}

export async function createIssue(
  cfg: GithubClientConfig,
  input: CreateIssueInput,
): Promise<CreateIssueResult> {
  const url = `${BASE}/repos/${cfg.repo}/issues`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { ...HEADERS_BASE, Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels }),
    });
  } catch (err) {
    throw new GithubNetworkError(err instanceof Error ? err.message : "fetch failed");
  }
  if (res.status !== 201) {
    throwForStatus(res, await readErrorMessage(res));
  }
  const data = (await res.json()) as { html_url?: string; number?: number };
  if (!data?.html_url || typeof data?.number !== "number") {
    throw new GithubError("server", "GitHub issues response missing html_url/number", 201);
  }
  return { issueUrl: data.html_url, issueNumber: data.number };
}
