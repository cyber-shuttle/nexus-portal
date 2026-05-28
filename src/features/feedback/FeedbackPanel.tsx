"use client";

import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import {
  ArrowUpRight,
  Eraser,
  Pen,
  Square,
  Trash2,
  Type,
  Undo2,
  X,
} from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import {
  type ChangeEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { buildFeedbackContext } from "./buildContext";
import { blobUrlToDataUrl, saveDraft } from "./draftStorage";
import { FeedbackOverlay } from "./FeedbackOverlay";
import { useFeedback } from "./FeedbackProvider";
import { flattenToPng, shapesToJson } from "./serializer";
import type { ComponentOutline, Shape, Tool } from "./types";

const TOOLS: { id: Tool; label: string; hint: string; Icon: typeof Square }[] = [
  { id: "rect", label: "Rectangle", hint: "Draw a rectangle outline", Icon: Square },
  { id: "arrow", label: "Arrow", hint: "Draw an arrow", Icon: ArrowUpRight },
  { id: "text", label: "Text", hint: "Click on the screen to add a text label", Icon: Type },
  { id: "pen", label: "Pen", hint: "Free-draw on the screen", Icon: Pen },
  {
    id: "redact",
    label: "Redact",
    hint: "Black out a region to hide sensitive info before submitting",
    Icon: Eraser,
  },
];

const MIN_COMMENT = 10;
const MAX_COMMENT = 5000;

const EMPTY_OUTLINE: ComponentOutline = {
  pageTitle: "",
  headings: [],
  navActive: "",
  navSiblings: [],
  primaryButtons: [],
  slots: [],
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("FileReader returned non-string"));
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export default function FeedbackPanel() {
  const {
    capturedImageUrl,
    capturedOutline,
    captureError,
    closeMode,
    snapshotConsoleEntries,
    restoredDraft,
    consumeRestoredDraft,
  } = useFeedback();
  const { data: session } = useSession();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [tool, setTool] = useState<Tool>("rect");
  const [shapes, setShapes] = useState<Shape[]>(() => restoredDraft?.shapes ?? []);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [comment, setComment] = useState(() => restoredDraft?.comment ?? "");
  const [screenshotDropped, setScreenshotDropped] = useState(
    () => restoredDraft?.screenshotDropped ?? false,
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imageDims, setImageDims] = useState<{ w: number; h: number } | null>(null);

  // Single-shot: the panel claimed the restored draft, clear it so a future
  // remount does not re-seed.
  useEffect(() => {
    if (restoredDraft) consumeRestoredDraft();
  }, [restoredDraft, consumeRestoredDraft]);

  const screenshotActive = !!capturedImageUrl && !screenshotDropped;
  const screenshotFailed = !capturedImageUrl && !!captureError;
  const trimmedComment = comment.trim();
  // When a screenshot is shown, hold Submit until imageDims arrive — otherwise
  // an early click ships text-only despite the user seeing the screenshot.
  const screenshotReady = !screenshotActive || imageDims !== null;
  const canSubmit = trimmedComment.length >= MIN_COMMENT && !submitting && screenshotReady;
  const isDirty = trimmedComment.length > 0 || shapes.length > 0;

  const attemptClose = useCallback(() => {
    if (isDirty && !window.confirm("Discard your suggestion?")) return;
    closeMode();
  }, [closeMode, isDirty]);

  // Stash the latest attemptClose in a ref so the mount effect below can read
  // it without re-running on every isDirty flip — otherwise typing the first
  // character tears down + re-mounts the dialog and steals focus from the
  // textarea.
  const attemptCloseRef = useRef(attemptClose);
  useEffect(() => {
    attemptCloseRef.current = attemptClose;
  }, [attemptClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    previouslyFocused.current = (document.activeElement as HTMLElement | null) ?? null;
    dialog.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      attemptCloseRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => {
      dialog.removeEventListener("cancel", onCancel);
      if (dialog.open) dialog.close();
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        if (shapes.length > 0) {
          e.preventDefault();
          setShapes((s) => s.slice(0, -1));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shapes.length]);

  const onCommitShape = useCallback((s: Shape) => {
    setShapes((prev) => [...prev, s]);
  }, []);

  const onUndo = () => setShapes((s) => s.slice(0, -1));
  const onClear = () => {
    if (shapes.length === 0) return;
    setShapes([]);
    setDraft(null);
  };
  const onRemoveScreenshot = () => {
    setScreenshotDropped(true);
    setShapes([]);
    setDraft(null);
  };

  const onImageLoad = (e: ChangeEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setImageDims({ w: target.naturalWidth, h: target.naturalHeight });
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    // Lazy auth: any signed-in user can compose; we only ask for GitHub when
    // they actually try to file the issue. The draft is stashed to sessionStorage
    // before the redirect so the user lands back on a pre-populated panel.
    const hasGithubSession =
      session?.provider === "github" && typeof session?.accessToken === "string";
    if (!hasGithubSession) {
      let screenshotDataUrl: string | null = null;
      if (screenshotActive && capturedImageUrl) {
        try {
          screenshotDataUrl = await blobUrlToDataUrl(capturedImageUrl);
        } catch {
          // Best effort — submitting without the image is still valid.
        }
      }
      saveDraft({
        comment,
        shapes,
        screenshotDropped,
        screenshotDataUrl,
        capturedOutline: capturedOutline ?? null,
      });
      toast.message("Sign in with GitHub to file your suggestion. Your draft is saved.");
      await signIn("github", { callbackUrl: window.location.href });
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      let imagePngBase64: string | undefined;
      let annotations: ReturnType<typeof shapesToJson> | undefined;
      if (screenshotActive && imgRef.current && imageDims) {
        const blob = await flattenToPng(imgRef.current, shapes, imageDims);
        imagePngBase64 = await blobToBase64(blob);
        if (shapes.length > 0) annotations = shapesToJson(shapes, imageDims);
      }
      // Server stamps reporterEmail from the session before zod parse; this
      // placeholder is only here to satisfy the schema if session is missing.
      const reporterEmail = session?.user?.email ?? "unknown@local";
      const persona = session?.user?.role ?? "unknown";
      const context = buildFeedbackContext(
        {
          pathname: pathname ?? "/",
          persona,
          reporterEmail,
          buildSha: process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev",
          consoleEntries: snapshotConsoleEntries(),
          outline: capturedOutline ?? EMPTY_OUTLINE,
        },
        window,
      );
      const payload = { comment: trimmedComment, imagePngBase64, annotations, context };
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok: true; issueUrl: string; issueNumber: number }
        | { ok: false; error: string }
        | null;
      if (res.ok && data?.ok) {
        const { issueUrl, issueNumber } = data;
        const isMock = issueUrl.includes("/issues/MOCK-");
        const base =
          issueNumber > 0 ? `Suggestion filed as #${issueNumber}` : "Suggestion filed";
        toast.success(isMock ? `${base} (dev mock)` : base, {
          action: {
            label: "View on GitHub",
            onClick: () => window.open(issueUrl, "_blank", "noopener,noreferrer"),
          },
        });
        closeMode();
      } else {
        const msg = data && !data.ok ? data.error : `Submit failed (${res.status})`;
        setSubmitError(msg);
        toast.error(msg);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCommentKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      attemptClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-feedback-ignore
      aria-labelledby="feedback-panel-title"
      className="fixed inset-0 z-50 m-0 flex h-screen max-h-none w-screen max-w-none flex-col bg-black/80 text-foreground backdrop:bg-transparent open:flex"
    >
      <div className="flex items-start justify-between gap-6 border-b border-border bg-background px-6 py-3">
        <div>
          <h2 id="feedback-panel-title" className="text-sm font-semibold text-foreground">
            Suggestion mode
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Best for screens and forms; charts may render imperfectly.
          </p>
        </div>
        {screenshotActive ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRemoveScreenshot}
            aria-label="Remove screenshot from this suggestion"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Remove screenshot
          </Button>
        ) : null}
      </div>

      {screenshotActive ? (
        <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
          <div className="relative inline-block max-h-[60vh] max-w-[90vw]">
            <img
              ref={imgRef}
              src={capturedImageUrl ?? ""}
              alt="Captured screen"
              onLoad={onImageLoad}
              className="block max-h-[60vh] max-w-[90vw] rounded-md border border-border bg-background object-contain shadow-2xl"
            />
            {imageDims ? (
              <FeedbackOverlay
                width={imageDims.w}
                height={imageDims.h}
                tool={tool}
                shapes={shapes}
                draft={draft}
                onDraftUpdate={setDraft}
                onCommitShape={onCommitShape}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {screenshotFailed
              ? "Screenshot capture failed — your suggestion will be filed as text-only with the page's structural context."
              : "Screenshot removed — your suggestion will be filed with just the text and the page's structural context."}
          </div>
        </div>
      )}

      <div className="border-t border-border bg-background px-6 py-3">
        {screenshotActive ? (
          <div className="mb-3 flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
              {TOOLS.map(({ id, label, hint, Icon }) => (
                <Tooltip key={id}>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant={tool === id ? "default" : "ghost"}
                        size="icon-sm"
                        aria-label={label}
                        aria-pressed={tool === id}
                        onClick={() => setTool(id)}
                      >
                        <Icon className="h-4 w-4" />
                      </Button>
                    }
                  />
                  <TooltipContent>
                    <div className="font-medium">{label}</div>
                    <div className="text-xs opacity-80">{hint}</div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            <div className="flex-1" />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUndo}
              disabled={shapes.length === 0}
            >
              <Undo2 className="mr-1.5 h-4 w-4" /> Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClear}
              disabled={shapes.length === 0}
            >
              <X className="mr-1.5 h-4 w-4" /> Clear
            </Button>
          </div>
        ) : null}

        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="mb-1 flex items-center justify-between">
              <label htmlFor="feedback-comment" className="text-xs font-medium text-foreground">
                Tell us what you'd suggest
              </label>
              <small className="text-xs text-muted-foreground">
                {trimmedComment.length}/{MAX_COMMENT}
              </small>
            </div>
            <textarea
              id="feedback-comment"
              rows={3}
              maxLength={MAX_COMMENT}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={handleCommentKey}
              placeholder="Tell us what you'd suggest… (min 10 characters)"
              className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your sign-in email, the current route, and a structural snapshot of this page will be
              included automatically.
            </p>
            {submitError ? (
              <p className="mt-2 text-xs text-destructive">{submitError}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 pt-5">
            <Button onClick={onSubmit} disabled={!canSubmit}>
              {submitting ? "Submitting…" : "Submit"}
            </Button>
            <Button variant="outline" onClick={attemptClose} disabled={submitting}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
