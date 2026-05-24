import type { ConsoleEntry } from "./consoleBuffer";
import type { ComponentOutline, FeedbackContext } from "./types";

export type BuildContextInput = {
  pathname: string;
  persona: string;
  reporterEmail: string;
  buildSha: string;
  consoleEntries: ConsoleEntry[];
  outline: ComponentOutline;
};

const MAX_CONSOLE = 10;

function formatEntry(e: ConsoleEntry): string {
  const msg = `[${e.timestamp}] [${e.level}] ${e.message}`;
  return msg.length > 2000 ? msg.slice(0, 2000) : msg;
}

export function buildFeedbackContext(input: BuildContextInput, win: Window): FeedbackContext {
  const entries =
    input.consoleEntries.length > MAX_CONSOLE
      ? input.consoleEntries.slice(input.consoleEntries.length - MAX_CONSOLE)
      : input.consoleEntries;
  return {
    route: input.pathname,
    persona: input.persona,
    reporterEmail: input.reporterEmail,
    viewport: { w: win.innerWidth, h: win.innerHeight },
    userAgent: win.navigator.userAgent,
    buildSha: input.buildSha,
    timestamp: new Date().toISOString(),
    consoleErrors: entries.map(formatEntry),
    componentOutline: input.outline,
  };
}
