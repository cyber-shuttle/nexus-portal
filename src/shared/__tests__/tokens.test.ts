import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Smoke test guarding the Phase S0 token reconciliation: protects against
// accidental regressions of the gray scale and brand semantic tokens.
const tokensPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../design-tokens/colors.css",
);
const tokens = readFileSync(tokensPath, "utf8");

describe("design-tokens/colors.css", () => {
  it("uses the reconciled gray scale values", () => {
    expect(tokens).toContain("--nexus-gray-900: #111111");
    expect(tokens).toContain("--nexus-gray-100: #f1f1f1");
  });

  it("defines the brand semantic in :root", () => {
    expect(tokens).toContain("--primary: oklch(0.205 0 0)");
    expect(tokens).toContain("--primary-foreground: oklch(0.985 0 0)");
    expect(tokens).toContain("--brand: var(--nexus-blue-500)");
    expect(tokens).toContain("--brand-foreground: #ffffff");
    expect(tokens).toContain("--brand-tint: var(--nexus-blue-50)");
  });

  it("mirrors the brand semantic under .dark", () => {
    const darkBlockMatch = tokens.match(/\.dark\s*{[^}]*}/);
    expect(darkBlockMatch, "expected a .dark { ... } block").not.toBeNull();
    const darkBlock = darkBlockMatch?.[0] ?? "";
    expect(darkBlock).toContain("--brand: var(--nexus-blue-400)");
    expect(darkBlock).toContain("--brand-tint:");
  });
});
