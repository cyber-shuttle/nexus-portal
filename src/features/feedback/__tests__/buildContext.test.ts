import { describe, expect, it } from "vitest";
import { buildFeedbackContext } from "../buildContext";
import type { ConsoleEntry } from "../consoleBuffer";
import { FeedbackContextSchema, type ComponentOutline } from "../types";

const emptyOutline: ComponentOutline = {
  pageTitle: "",
  headings: [],
  navActive: "",
  navSiblings: [],
  primaryButtons: [],
  slots: [],
};

function fakeWindow(overrides: Partial<{ w: number; h: number; ua: string }> = {}): Window {
  return {
    innerWidth: overrides.w ?? 1440,
    innerHeight: overrides.h ?? 900,
    navigator: { userAgent: overrides.ua ?? "test-agent/1.0" },
  } as unknown as Window;
}

describe("buildFeedbackContext", () => {
  it("maps ConsoleEntry to formatted string lines", () => {
    const entries: ConsoleEntry[] = [
      { level: "error", message: "boom", timestamp: "2026-05-23T10:00:00.000Z" },
      { level: "warn", message: "hmm", timestamp: "2026-05-23T10:00:01.000Z" },
    ];
    const ctx = buildFeedbackContext(
      {
        pathname: "/projects",
        persona: "pi",
        reporterEmail: "pi@example.org",
        buildSha: "abc123",
        consoleEntries: entries,
        outline: emptyOutline,
      },
      fakeWindow(),
    );
    expect(ctx.consoleErrors).toEqual([
      "[2026-05-23T10:00:00.000Z] [error] boom",
      "[2026-05-23T10:00:01.000Z] [warn] hmm",
    ]);
  });

  it("caps consoleErrors at 10 (drops oldest)", () => {
    const entries: ConsoleEntry[] = Array.from({ length: 15 }, (_, i) => ({
      level: "error",
      message: `msg-${i}`,
      timestamp: `2026-05-23T10:00:${String(i).padStart(2, "0")}.000Z`,
    }));
    const ctx = buildFeedbackContext(
      {
        pathname: "/x",
        persona: "user",
        reporterEmail: "u@x.org",
        buildSha: "dev",
        consoleEntries: entries,
        outline: emptyOutline,
      },
      fakeWindow(),
    );
    expect(ctx.consoleErrors).toHaveLength(10);
    expect(ctx.consoleErrors[0]).toContain("msg-5");
    expect(ctx.consoleErrors[9]).toContain("msg-14");
  });

  it("reads viewport from win.innerWidth/Height", () => {
    const ctx = buildFeedbackContext(
      {
        pathname: "/x",
        persona: "user",
        reporterEmail: "u@x.org",
        buildSha: "dev",
        consoleEntries: [],
        outline: emptyOutline,
      },
      fakeWindow({ w: 1920, h: 1080, ua: "RobotKit/2.0" }),
    );
    expect(ctx.viewport).toEqual({ w: 1920, h: 1080 });
    expect(ctx.userAgent).toBe("RobotKit/2.0");
  });

  it("produces output that passes FeedbackContextSchema", () => {
    const ctx = buildFeedbackContext(
      {
        pathname: "/projects",
        persona: "user",
        reporterEmail: "u@x.org",
        buildSha: "abc",
        consoleEntries: [],
        outline: emptyOutline,
      },
      fakeWindow(),
    );
    const result = FeedbackContextSchema.safeParse(ctx);
    expect(result.success).toBe(true);
  });
});
