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
      const describe = (v: unknown): string => {
        if (v === null) return "null";
        if (v === undefined) return "undefined";
        if (typeof v === "string") return `string(${v.length}) head=${JSON.stringify(v.slice(0, 40))}`;
        if (Array.isArray(v)) return `array(${v.length})`;
        if (typeof v === "object") return `object{${Object.keys(v).join(",")}}`;
        return typeof v;
      };
      const top =
        json && typeof json === "object"
          ? Object.fromEntries(Object.entries(json as Record<string, unknown>).map(([k, v]) => [k, describe(v)]))
          : null;
      console.error(
        "feedback validation FAILED — topShape=%j fieldErrors=%j formErrors=%j",
        top,
        flat.fieldErrors,
        flat.formErrors,
      );
      return NextResponse.json(
        { ok: false, error: "invalid payload", issues: flat },
        { status: 400 },
      );
    }
    const payload = parsed.data;

    // Two distinct concerns:
    //  - Issue creation: prefer the user's token so the issue is attributed
    //    to them. Falls back to the bot PAT only when no session token.
    //  - Image commit (PUT /contents): always uses the bot PAT — writing to
    //    a service-owned images branch is housekeeping, and non-collaborator
    //    user tokens can't write to /contents even on public repos.
    const sessionToken =
      session.provider === "github" && typeof session.accessToken === "string"
        ? session.accessToken
        : undefined;
    const issueToken = sessionToken ?? serverEnv.FEEDBACK_GITHUB_TOKEN;
    const imageToken = serverEnv.FEEDBACK_GITHUB_TOKEN ?? sessionToken;

    if (!issueToken) {
      if (process.env.NODE_ENV === "production") {
        // No usable credential for the issue. Should never fire in normal
        // use — either the UI bypassed the lazy OAuth redirect or the bot
        // PAT is missing in env.
        console.error(
          "no GitHub credential for issue creation — session.provider=%s, FEEDBACK_GITHUB_TOKEN set=%s",
          session.provider,
          Boolean(serverEnv.FEEDBACK_GITHUB_TOKEN),
        );
        return NextResponse.json(
          { ok: false, error: "feedback service not configured" },
          { status: 503 },
        );
      }
      console.warn("no github credential available — returning mock issue URL (dev only)");
      const mockId = randomUUID();
      return NextResponse.json({
        ok: true,
        issueUrl: `https://github.com/${serverEnv.FEEDBACK_GITHUB_REPO}/issues/MOCK-${mockId}`,
        issueNumber: 0,
      });
    }

    const repo = serverEnv.FEEDBACK_GITHUB_REPO;

    let rawUrl: string | undefined;
    if (payload.imagePngBase64 && imageToken) {
      try {
        const result = await commitImageToRepo(
          { token: imageToken, repo },
          payload.imagePngBase64,
          `${randomUUID()}.png`,
          `feedback: image for issue from ${payload.context.reporterEmail}`,
          serverEnv.FEEDBACK_IMAGES_BRANCH,
        );
        rawUrl = result.rawUrl;
      } catch (err) {
        // Don't fail the whole submission if just the image upload failed —
        // the comment + annotations + context are still valuable. Log and
        // continue.
        console.warn("image commit failed; filing issue without screenshot:", err);
      }
    }

    const githubLogin = sessionToken ? (await getAuthedUserLogin(sessionToken)) ?? undefined : undefined;

    try {
      const result = await createIssue(
        { token: issueToken, repo },
        {
          title: issueTitle(payload.comment),
          body: issueBody({
            comment: payload.comment,
            imageRawUrl: rawUrl,
            annotations: payload.annotations,
            context: payload.context,
            githubLogin,
          }),
          labels: [serverEnv.FEEDBACK_LABEL],
        },
      );
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
