import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TOKEN = "FEEDBACK_GITHUB_TOKEN";
const SRC = path.resolve(__dirname, "../../../");

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const stat = statSync(p);
    if (stat.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === "__snapshots__") continue;
      walk(p, acc);
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      acc.push(p);
    }
  }
  return acc;
}

describe("no client-side FEEDBACK_GITHUB_TOKEN leak", () => {
  const files = walk(SRC);

  it("every file referencing FEEDBACK_GITHUB_TOKEN is either env.ts or server-only", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes(TOKEN)) continue;
      const rel = path.relative(SRC, file);
      if (rel === "lib/env.ts") continue;
      const isApiRoute = rel.startsWith(`app${path.sep}api${path.sep}`);
      const isServerOnly = /^\s*import\s+["']server-only["']/m.test(text);
      const isTest = rel.includes("__tests__");
      if (!isServerOnly && !isApiRoute && !isTest) {
        offenders.push(rel);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no 'use client' file references FEEDBACK_GITHUB_TOKEN", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (!text.includes(TOKEN)) continue;
      const head = text.slice(0, 200);
      if (/^["']use client["']/m.test(head)) {
        offenders.push(path.relative(SRC, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
