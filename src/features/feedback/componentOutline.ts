import type { ComponentOutline } from "./types";

const TEXT_CAP = 300;
const NAV_TEXT_CAP = 120;
const BUTTON_TEXT_CAP = 120;
const SLOT_CAP = 80;
const HEADINGS_MAX = 100;
const NAV_SIBLINGS_MAX = 40;
const PRIMARY_BUTTONS_MAX = 80;
const SLOTS_MAX = 120;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function isVisible(el: Element, win: Window): boolean {
  if ((el as HTMLElement).hidden) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  const style = safe(() => win.getComputedStyle(el), null);
  if (style && (style.display === "none" || style.visibility === "hidden")) return false;
  return true;
}

function trimText(text: string | null | undefined, cap: number): string {
  if (!text) return "";
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > cap ? trimmed.slice(0, cap) : trimmed;
}

function uniq(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

function captureHeadings(
  doc: Document,
  win: Window,
): ComponentOutline["headings"] {
  return safe(() => {
    const out: ComponentOutline["headings"] = [];
    const nodes = doc.querySelectorAll("h1, h2, h3");
    for (const node of Array.from(nodes)) {
      if (out.length >= HEADINGS_MAX) break;
      if (!isVisible(node, win)) continue;
      const text = trimText(node.textContent, TEXT_CAP);
      if (!text) continue;
      const level = Number(node.tagName.substring(1));
      out.push({ level, text });
    }
    return out;
  }, []);
}

function captureNav(
  doc: Document,
  win: Window,
): { navActive: string; navSiblings: string[] } {
  return safe(() => {
    const active = doc.querySelector('[aria-current="page"]');
    if (!active || !isVisible(active, win)) {
      return { navActive: "", navSiblings: [] };
    }
    const navActive = trimText(active.textContent, NAV_TEXT_CAP);
    const container =
      safe(() => active.closest("nav") as Element | null, null) ??
      safe(() => active.closest("aside") as Element | null, null) ??
      active.parentElement;
    const siblings: string[] = [];
    if (container) {
      const links = container.querySelectorAll("a");
      for (const link of Array.from(links)) {
        if (link === active) continue;
        if (!isVisible(link, win)) continue;
        const text = trimText(link.textContent, NAV_TEXT_CAP);
        if (text) siblings.push(text);
      }
    }
    return { navActive, navSiblings: uniq(siblings).slice(0, NAV_SIBLINGS_MAX) };
  }, { navActive: "", navSiblings: [] });
}

function capturePrimaryButtons(doc: Document, win: Window): string[] {
  return safe(() => {
    const out: string[] = [];
    const buttons = doc.querySelectorAll('button, a[role="button"]');
    for (const b of Array.from(buttons)) {
      if (!isVisible(b, win)) continue;
      const text = trimText(b.textContent, BUTTON_TEXT_CAP);
      if (text) out.push(text);
    }
    const main = doc.querySelector("main");
    if (main) {
      const links = main.querySelectorAll("a");
      for (const a of Array.from(links)) {
        if (!isVisible(a, win)) continue;
        if (a.getAttribute("role") === "button") continue;
        const text = trimText(a.textContent, BUTTON_TEXT_CAP);
        if (text) out.push(text);
      }
    }
    return uniq(out).slice(0, PRIMARY_BUTTONS_MAX);
  }, []);
}

function captureSlots(doc: Document): string[] {
  return safe(() => {
    const nodes = doc.querySelectorAll("[data-slot]");
    const values: string[] = [];
    for (const n of Array.from(nodes)) {
      const v = n.getAttribute("data-slot");
      if (v) {
        const trimmed = trimText(v, SLOT_CAP);
        if (trimmed) values.push(trimmed);
      }
    }
    return uniq(values).slice(0, SLOTS_MAX);
  }, []);
}

export function captureComponentOutline(doc: Document, win: Window): ComponentOutline {
  const pageTitle = safe(() => trimText(doc.title, TEXT_CAP), "");
  const headings = captureHeadings(doc, win);
  const { navActive, navSiblings } = captureNav(doc, win);
  const primaryButtons = capturePrimaryButtons(doc, win);
  const slots = captureSlots(doc);
  return { pageTitle, headings, navActive, navSiblings, primaryButtons, slots };
}
