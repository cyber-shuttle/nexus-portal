"use client";

import type { ComponentOutline } from "./types";
import type { Shape } from "./types";

const KEY = "nexus.feedback.pendingDraft";
const TTL_MS = 10 * 60 * 1000;
const SCHEMA_VERSION = 1;

export type FeedbackDraft = {
  schemaVersion: 1;
  capturedAt: number;
  comment: string;
  shapes: Shape[];
  screenshotDropped: boolean;
  // Data URL (base64), not a blob URL — blob URLs do not survive a page reload.
  screenshotDataUrl: string | null;
  capturedOutline: ComponentOutline | null;
};

export function saveDraft(draft: Omit<FeedbackDraft, "schemaVersion" | "capturedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const payload: FeedbackDraft = {
      ...draft,
      schemaVersion: SCHEMA_VERSION,
      capturedAt: Date.now(),
    };
    sessionStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — best-effort, swallow.
  }
}

export function loadDraft(): FeedbackDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FeedbackDraft;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    if (Date.now() - parsed.capturedAt > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    sessionStorage.removeItem(KEY);
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage disabled — nothing to do.
  }
}

// Reading a Blob URL back to a data URL so it survives the OAuth redirect.
export async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}
