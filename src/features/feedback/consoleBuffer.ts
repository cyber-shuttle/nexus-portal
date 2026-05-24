export type ConsoleEntry = { level: "error" | "warn"; message: string; timestamp: string };

export type ConsoleBuffer = {
  install(): void;
  uninstall(): void;
  snapshot(): ConsoleEntry[];
  clear(): void;
};

const INSTALLED = Symbol.for("nexus.feedback.consoleBuffer.installed");

const MAX_MESSAGE_CHARS = 2000;

function serializeArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  try {
    if (arg !== null && typeof arg === "object") return JSON.stringify(arg);
    return String(arg);
  } catch {
    return "[unserializable]";
  }
}

function format(args: unknown[]): string {
  const joined = args.map(serializeArg).join(" ");
  return joined.length > MAX_MESSAGE_CHARS ? joined.slice(0, MAX_MESSAGE_CHARS) : joined;
}

type Installable = Console & { [INSTALLED]?: boolean };

export function createConsoleBuffer(capacity = 10): ConsoleBuffer {
  const ring: ConsoleEntry[] = [];
  let originalError: typeof console.error | null = null;
  let originalWarn: typeof console.warn | null = null;

  const record = (level: "error" | "warn", args: unknown[]) => {
    ring.push({ level, message: format(args), timestamp: new Date().toISOString() });
    if (ring.length > capacity) ring.splice(0, ring.length - capacity);
  };

  return {
    install() {
      const c = console as Installable;
      if (c[INSTALLED]) return;
      originalError = console.error;
      originalWarn = console.warn;
      console.error = (...args: unknown[]) => {
        record("error", args);
        originalError?.apply(console, args as []);
      };
      console.warn = (...args: unknown[]) => {
        record("warn", args);
        originalWarn?.apply(console, args as []);
      };
      c[INSTALLED] = true;
    },
    uninstall() {
      const c = console as Installable;
      if (!c[INSTALLED]) return;
      if (originalError) console.error = originalError;
      if (originalWarn) console.warn = originalWarn;
      originalError = null;
      originalWarn = null;
      c[INSTALLED] = false;
    },
    snapshot() {
      return ring.slice();
    },
    clear() {
      ring.length = 0;
    },
  };
}
