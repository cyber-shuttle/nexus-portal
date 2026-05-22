"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Shadows the browser history stack so the topbar chevrons can render disabled
// when there's nowhere to go. Next.js doesn't surface a usable history cursor,
// so we track a path stack in sessionStorage and bind it to popstate.
//
// stack: pathnames the user has visited in order; cursor: current index into stack.
//
// Push (router.push/replace) → truncate forward, append, cursor = stack.length - 1.
// Pop  (back/forward chevron) → cursor moves to whichever known index matches
// the new pathname; if no match (deep-link refresh, history replaced), reset.
export function useNavHistory(): { canGoBack: boolean; canGoForward: boolean } {
  const pathname = usePathname();
  const popped = useRef(false);
  const [state, setState] = useState({ canGoBack: false, canGoForward: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || pathname == null) return;
    const KEY_STACK = "nexus.nav.stack";
    const KEY_CURSOR = "nexus.nav.cursor";
    const raw = sessionStorage.getItem(KEY_STACK);
    let stack: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    let cursor = Number(sessionStorage.getItem(KEY_CURSOR) ?? "-1");

    if (popped.current) {
      popped.current = false;
      // Reconcile cursor against the known stack; prefer adjacent matches so
      // multi-step jumps still feel right.
      if (stack[cursor - 1] === pathname) cursor -= 1;
      else if (stack[cursor + 1] === pathname) cursor += 1;
      else {
        const idx = stack.indexOf(pathname);
        if (idx >= 0) cursor = idx;
      }
    } else if (stack[cursor] !== pathname) {
      // Truncate the forward stack and push.
      stack = stack.slice(0, cursor + 1);
      stack.push(pathname);
      cursor = stack.length - 1;
    }

    sessionStorage.setItem(KEY_STACK, JSON.stringify(stack));
    sessionStorage.setItem(KEY_CURSOR, String(cursor));
    setState({ canGoBack: cursor > 0, canGoForward: cursor < stack.length - 1 });
  }, [pathname]);

  return state;
}
