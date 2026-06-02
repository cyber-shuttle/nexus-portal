"use client";

import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { captureComponentOutline } from "./componentOutline";
import { type ConsoleEntry, createConsoleBuffer } from "./consoleBuffer";
import { clearDraft, type FeedbackDraft, loadDraft } from "./draftStorage";
import type { ComponentOutline } from "./types";

const FeedbackPanel = dynamic(() => import("./FeedbackPanel"), {
  ssr: false,
  loading: () => null,
});

// Module-scope singleton so the buffer survives provider remounts.
const consoleBuffer = createConsoleBuffer(10);

type FeedbackContextValue = {
  panelOpen: boolean;
  isCapturing: boolean;
  capturedImageUrl: string | null;
  capturedOutline: ComponentOutline | null;
  captureError: string | null;
  // Set non-null exactly once when a pending draft is restored after a github
  // OAuth redirect. The panel reads this on mount to populate its local state,
  // then calls consumeRestoredDraft() to clear it.
  restoredDraft: FeedbackDraft | null;
  consumeRestoredDraft: () => void;
  openMode: () => Promise<void>;
  closeMode: () => void;
  snapshotConsoleEntries: () => ConsoleEntry[];
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [panelOpen, setPanelOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [capturedImageUrl, setCapturedImageUrl] = useState<string | null>(null);
  const [capturedOutline, setCapturedOutline] = useState<ComponentOutline | null>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [restoredDraft, setRestoredDraft] = useState<FeedbackDraft | null>(null);
  const urlRef = useRef<string | null>(null);
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    consoleBuffer.install();
  }, []);

  // Restore a pending draft (saved before the github OAuth redirect) the first
  // time we land back with a github session. One-shot: the ref guards against
  // re-firing if the session object reference churns.
  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    if (status !== "authenticated") return;
    if (session?.provider !== "github") return;
    restoreAttemptedRef.current = true;
    const draft = loadDraft();
    if (!draft) return;
    clearDraft();
    setRestoredDraft(draft);
    setCapturedImageUrl(draft.screenshotDataUrl);
    setCapturedOutline(draft.capturedOutline);
    setPanelOpen(true);
    toast.message("Welcome back — filing your suggestion…");
  }, [status, session?.provider]);

  const consumeRestoredDraft = useCallback(() => {
    setRestoredDraft(null);
  }, []);

  const revokeUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const closeMode = useCallback(() => {
    setPanelOpen(false);
    setCapturedImageUrl(null);
    setCapturedOutline(null);
    setCaptureError(null);
    setIsCapturing(false);
    setRestoredDraft(null);
    clearDraft();
    revokeUrl();
  }, [revokeUrl]);

  const openMode = useCallback(async () => {
    setCaptureError(null);
    setIsCapturing(true);
    const outlinePromise = Promise.resolve().then(() =>
      captureComponentOutline(document, window),
    );
    try {
      const { captureViewport } = await import("./capture");
      const [blob, outline] = await Promise.all([captureViewport(), outlinePromise]);
      revokeUrl();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setCapturedImageUrl(url);
      setCapturedOutline(outline);
    } catch (err) {
      // Screenshot failed; panel still opens text-only with the outline.
      const outline = await outlinePromise.catch(() => null);
      setCapturedOutline(outline);
      setCaptureError(err instanceof Error ? err.message : "Capture failed");
    } finally {
      setPanelOpen(true);
      setIsCapturing(false);
    }
  }, [revokeUrl]);

  useEffect(() => revokeUrl, [revokeUrl]);

  const snapshotConsoleEntries = useCallback(() => consoleBuffer.snapshot(), []);

  const value = useMemo<FeedbackContextValue>(
    () => ({
      panelOpen,
      isCapturing,
      capturedImageUrl,
      capturedOutline,
      captureError,
      restoredDraft,
      consumeRestoredDraft,
      openMode,
      closeMode,
      snapshotConsoleEntries,
    }),
    [
      panelOpen,
      isCapturing,
      capturedImageUrl,
      capturedOutline,
      captureError,
      restoredDraft,
      consumeRestoredDraft,
      openMode,
      closeMode,
      snapshotConsoleEntries,
    ],
  );

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {panelOpen ? <FeedbackPanel /> : null}
    </FeedbackContext.Provider>
  );
}

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used inside <FeedbackProvider>");
  return ctx;
}
