import { describe, expect, it } from "vitest";
import { issueBody, issueTitle } from "../issueBody";
import type { FeedbackContext, Shape } from "../types";

const baseContext: FeedbackContext = {
  route: "/projects",
  persona: "pi",
  reporterEmail: "pi@example.org",
  viewport: { w: 1440, h: 900 },
  userAgent: "Mozilla/5.0 test",
  buildSha: "abc123f",
  timestamp: "2026-05-23T14:22:11Z",
  consoleErrors: [
    "2026-05-23T14:21:58Z [error] Failed to fetch /api/v1/projects/123 (404)",
  ],
  componentOutline: {
    pageTitle: "Projects",
    headings: [
      { level: 1, text: "Projects" },
      { level: 2, text: "Active projects (3)" },
      { level: 2, text: "Archived" },
    ],
    navActive: "Projects",
    navSiblings: ["Overview", "Analytics", "Allocations"],
    primaryButtons: ["New project", "Export"],
    slots: ["card", "card-header", "button"],
  },
};

const shapes: Shape[] = [{ id: "r1", type: "rect", x: 10, y: 20, w: 100, h: 50 }];
const annotations = { schemaVersion: 1 as const, imageWidth: 1440, imageHeight: 900, shapes };

describe("issueTitle", () => {
  it("prefixes Suggestion: and keeps short comments verbatim", () => {
    expect(issueTitle("Make the sidebar wider.")).toBe("Suggestion: Make the sidebar wider.");
  });

  it("hard-truncates at 80 chars with ellipsis", () => {
    const long = "x".repeat(120);
    const title = issueTitle(long);
    expect(title).toBe(`Suggestion: ${"x".repeat(80)}…`);
    expect(title.endsWith("…")).toBe(true);
  });

  it("collapses whitespace", () => {
    expect(issueTitle("  Make\n\nthings  better  ")).toBe("Suggestion: Make things better");
  });
});

describe("issueBody — with screenshot", () => {
  it("matches the snapshot", () => {
    const body = issueBody({
      comment: "The Active projects header is hard to scan.",
      imageRawUrl: "https://raw.example/x.png",
      annotations,
      context: baseContext,
    });
    expect(body).toMatchSnapshot();
  });
});

describe("issueBody — text-only", () => {
  it("matches the snapshot and omits image + annotations", () => {
    const body = issueBody({
      comment: "The Active projects header is hard to scan.",
      context: baseContext,
    });
    expect(body).toMatchSnapshot();
    expect(body).not.toContain("![annotated suggestion]");
    expect(body).not.toContain("Annotation metadata");
    expect(body.indexOf("```")).toBeLessThan(body.indexOf("## Context"));
  });
});

describe("issueBody — reporter formatting", () => {
  it("renders 'anonymous' when no githubLogin is provided (repo is public; no email leak)", () => {
    const body = issueBody({ comment: "Tiny note enough chars.", context: baseContext });
    expect(body).toContain("| Reporter | anonymous |");
    expect(body).not.toContain("pi@example.org");
    expect(body).not.toContain("mailto:");
  });

  it("renders @login only when githubLogin is provided — never the email", () => {
    const body = issueBody({
      comment: "Tiny note enough chars.",
      context: baseContext,
      githubLogin: "octocat",
    });
    expect(body).toContain("| Reporter | [@octocat](https://github.com/octocat) |");
    expect(body).not.toContain("pi@example.org");
    expect(body).not.toContain("mailto:");
  });
});

describe("issueBody — empty outline collapses", () => {
  it("omits empty outline lines", () => {
    const emptyOutlineCtx: FeedbackContext = {
      ...baseContext,
      consoleErrors: [],
      componentOutline: {
        pageTitle: "",
        headings: [],
        navActive: "",
        navSiblings: [],
        primaryButtons: [],
        slots: [],
      },
    };
    const body = issueBody({ comment: "Tiny note.", context: emptyOutlineCtx });
    expect(body).not.toMatch(/^Page:/m);
    expect(body).not.toMatch(/^H1:/m);
    expect(body).not.toMatch(/^Buttons:/m);
    expect(body).not.toMatch(/^Slots:/m);
    expect(body).toContain("(no structural snapshot captured)");
    expect(body).not.toContain("Recent client console errors");
  });
});
