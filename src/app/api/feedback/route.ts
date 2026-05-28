import { randomUUID } from "node:crypto";
import { serverEnv } from "@/lib/env";
import { auth } from "@/shared/auth/auth";
import { type NextRequest, NextResponse } from "next/server";
import {
  commitImageToRepo,
  createIssue,
  getAuthedUserLogin,
  GithubAuthError,
  GithubNotFoundError,
} from "@/features/feedback/githubClient";
import { issueBody, issueTitle } from "@/features/feedback/issueBody";
import { FeedbackPayloadSchema } from "@/features/feedback/types";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
    }
    // Stamp the authenticated email before validation — the client may send a
    // placeholder that fails the schema, and we never trust its identity claim.
    if (json && typeof json === "object" && "context" in json) {
      const ctx = (json as { context?: unknown }).context;
      if (ctx && typeof ctx === "object") {
        (ctx as { reporterEmail?: string }).reporterEmail = session.user.email;
      }
    }
    const parsed = FeedbackPayloadSchema.safeParse(json);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const shape = json && typeof json === "object" ? Object.keys(json) : [];
      const ctx =
        json && typeof json === "object" && "context" in json && json.context && typeof json.context === "object"
          ? Object.fromEntries(
              Object.entries(json.context as Record<string, unknown>).map(([k, v]) => [
                k,
                typeof v === "string"
                  ? `string(${v.length})`
                  : Array.isArray(v)
                    ? `array(${v.length})`
                    : v && typeof v === "object"
                      ? `object{${Object.keys(v).join(",")}}`
                      : typeof v,
              ]),
            )
          : null;
      console.error(
        "feedback validation FAILED — topShape=%j ctxShape=%j fieldErrors=%j formErrors=%j",
        shape,
        ctx,
        flat.fieldErrors,
        flat.formErrors,
      );
      return NextResponse.json(
        { ok: false, error: "invalid payload", issues: flat },
        { status: 400 },
      );
    }
    const payload = parsed.data;

    // Prefer the user's GitHub access token so the issue is attributed to them;
    // fall back to the bot PAT only when no session token is available.
    const sessionToken =
      session.provider === "github" && typeof session.accessToken === "string"
        ? session.accessToken
        : undefined;
    const token = sessionToken ?? serverEnv.FEEDBACK_GITHUB_TOKEN;

    if (!token) {
      if (process.env.NODE_ENV === "production") {
        console.error("FEEDBACK_GITHUB_TOKEN missing in production");
        return NextResponse.json(
          { ok: false, error: "feedback service not configured" },
          { status: 503 },
        );
      }
      console.warn("FEEDBACK_GITHUB_TOKEN not set — returning mock issue URL (dev only)");
      const mockId = randomUUID();
      return NextResponse.json({
        ok: true,
        issueUrl: `https://github.com/${serverEnv.FEEDBACK_GITHUB_REPO}/issues/MOCK-${mockId}`,
        issueNumber: 0,
      });
    }

    const cfg = { token, repo: serverEnv.FEEDBACK_GITHUB_REPO };

    let rawUrl: string | undefined;
    if (payload.imagePngBase64) {
      try {
        const result = await commitImageToRepo(
          cfg,
          payload.imagePngBase64,
          `${randomUUID()}.png`,
          `feedback: image for issue from ${payload.context.reporterEmail}`,
          serverEnv.FEEDBACK_IMAGES_BRANCH,
        );
        rawUrl = result.rawUrl;
      } catch (err) {
        return translateGithubError(err, "image commit failed");
      }
    }

    const githubLogin = sessionToken ? (await getAuthedUserLogin(sessionToken)) ?? undefined : undefined;

    try {
      const result = await createIssue(cfg, {
        title: issueTitle(payload.comment),
        body: issueBody({
          comment: payload.comment,
          imageRawUrl: rawUrl,
          annotations: payload.annotations,
          context: payload.context,
          githubLogin,
        }),
        labels: [serverEnv.FEEDBACK_LABEL],
      });
      return NextResponse.json({
        ok: true,
        issueUrl: result.issueUrl,
        issueNumber: result.issueNumber,
      });
    } catch (err) {
      return translateGithubError(err, "issue creation failed");
    }
  } catch (err) {
    console.error("feedback route unexpected error:", err);
    return NextResponse.json({ ok: false, error: "internal error" }, { status: 500 });
  }
}

function translateGithubError(err: unknown, context: string): NextResponse {
  console.error(`feedback route ${context}:`, err);
  if (err instanceof GithubAuthError) {
    return NextResponse.json({ ok: false, error: "service misconfigured" }, { status: 503 });
  }
  if (err instanceof GithubNotFoundError) {
    return NextResponse.json({ ok: false, error: "repo not found" }, { status: 503 });
  }
  return NextResponse.json({ ok: false, error: "github upstream error" }, { status: 502 });
}
