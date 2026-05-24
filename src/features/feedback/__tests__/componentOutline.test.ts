import { describe, expect, it } from "vitest";
import { captureComponentOutline } from "../componentOutline";
import { ComponentOutlineSchema } from "../types";

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe("captureComponentOutline", () => {
  it("captures pageTitle and headings in DOM order", () => {
    document.title = "Projects";
    setBody(`
      <main>
        <h1>Projects</h1>
        <h2>Active projects (3)</h2>
        <h3>Filter</h3>
        <h2>Archived</h2>
      </main>
    `);
    const out = captureComponentOutline(document, window);
    expect(out.pageTitle).toBe("Projects");
    expect(out.headings).toEqual([
      { level: 1, text: "Projects" },
      { level: 2, text: "Active projects (3)" },
      { level: 3, text: "Filter" },
      { level: 2, text: "Archived" },
    ]);
  });

  it("honors hidden, aria-hidden, and display:none filters", () => {
    setBody(`
      <h1 hidden>HiddenH1</h1>
      <h2 aria-hidden="true">AriaHidden</h2>
      <h3 style="display: none">DisplayNone</h3>
      <h1>Visible</h1>
    `);
    const out = captureComponentOutline(document, window);
    const texts = out.headings.map((h) => h.text);
    expect(texts).toContain("Visible");
    expect(texts).not.toContain("HiddenH1");
    expect(texts).not.toContain("AriaHidden");
    expect(texts).not.toContain("DisplayNone");
  });

  it("captures nav active label and sibling links, excluding the active link and deduping", () => {
    setBody(`
      <nav>
        <a href="/home">Home</a>
        <a href="/projects" aria-current="page">Projects</a>
        <a href="/analytics">Analytics</a>
        <a href="/analytics">Analytics</a>
        <a href="/allocations">Allocations</a>
      </nav>
    `);
    const out = captureComponentOutline(document, window);
    expect(out.navActive).toBe("Projects");
    expect(out.navSiblings).toEqual(["Home", "Analytics", "Allocations"]);
  });

  it("dedupes [data-slot] values across the document", () => {
    setBody(`
      <div data-slot="card">
        <div data-slot="card-header"></div>
        <div data-slot="card"></div>
        <button data-slot="button">Hello</button>
      </div>
    `);
    const out = captureComponentOutline(document, window);
    expect(out.slots.sort()).toEqual(["button", "card", "card-header"]);
  });

  it("captures visible primary buttons + role=button links + top-level main links", () => {
    setBody(`
      <main>
        <button>New project</button>
        <a role="button">Export</a>
        <a href="/cta">Continue</a>
        <button hidden>Hidden btn</button>
        <button>New project</button>
      </main>
    `);
    const out = captureComponentOutline(document, window);
    expect(out.primaryButtons).toContain("New project");
    expect(out.primaryButtons).toContain("Export");
    expect(out.primaryButtons).toContain("Continue");
    expect(out.primaryButtons).not.toContain("Hidden btn");
    // dedupe
    expect(out.primaryButtons.filter((b) => b === "New project")).toHaveLength(1);
  });

  it("returns a valid ComponentOutline (zod parses) even when DOM is essentially empty", () => {
    document.title = "";
    setBody("");
    const out = captureComponentOutline(document, window);
    const result = ComponentOutlineSchema.safeParse(out);
    expect(result.success).toBe(true);
    expect(out.headings).toEqual([]);
  });

  it("does not throw on a malformed DOM (link with null parent)", () => {
    setBody(`<a aria-current="page">Detached</a>`);
    const active = document.querySelector('[aria-current="page"]');
    active?.parentNode?.removeChild(active);
    expect(() => captureComponentOutline(document, window)).not.toThrow();
  });
});
