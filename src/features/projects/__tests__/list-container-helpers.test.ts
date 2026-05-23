import { describe, expect, it } from "vitest";
import {
  computeProjectRollup,
  dedupePiAndMemberProjects,
  emptyCopyFor,
  tagAsPlain,
} from "../list-helpers";
import type { Project } from "../schemas";

function project(id: string, pi = "someone-else@nexus.local"): Project {
  return {
    id,
    originated_id: `BIO-${id}`,
    title: `Project ${id}`,
    origination: "ACCESS",
    project_pi_id: pi,
    status: "ACTIVE",
    created_time: "2026-01-01T00:00:00.000Z",
  };
}

describe("dedupePiAndMemberProjects", () => {
  it("tags PI-only rows with the PI badge", () => {
    const result = dedupePiAndMemberProjects([project("a")], [], "pi@nexus.local");
    expect(result).toHaveLength(1);
    expect(result[0]?.membershipBadge).toBe("pi");
  });

  it("tags member-only rows with the member badge when caller is not the PI", () => {
    const result = dedupePiAndMemberProjects(
      [],
      [project("b", "other-pi@nexus.local")],
      "pi@nexus.local",
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.membershipBadge).toBe("member");
  });

  it("re-tags member-arm rows as PI when project_pi_id matches the caller", () => {
    // PIs are always seeded as members of their own allocations, so this row
    // can show up only on the member arm with stale upstream lists. The dedupe
    // must still mark it as a PI badge so the persona-aware UI is consistent.
    const result = dedupePiAndMemberProjects(
      [],
      [project("c", "pi@nexus.local")],
      "pi@nexus.local",
    );
    expect(result[0]?.membershipBadge).toBe("pi");
  });

  it("dedupes by id (PI arm wins)", () => {
    const a = project("dup", "pi@nexus.local");
    const result = dedupePiAndMemberProjects([a], [a], "pi@nexus.local");
    expect(result).toHaveLength(1);
    expect(result[0]?.membershipBadge).toBe("pi");
  });

  it("preserves insertion order: PI rows come before member-only rows", () => {
    const piRow = project("pi-1", "pi@nexus.local");
    const memberRow = project("mem-1", "other-pi@nexus.local");
    const result = dedupePiAndMemberProjects([piRow], [memberRow], "pi@nexus.local");
    expect(result.map((r) => r.project.id)).toEqual(["pi-1", "mem-1"]);
  });
});

describe("tagAsPlain", () => {
  it("returns null badge for every row (researcher + admin paths)", () => {
    const out = tagAsPlain([project("a"), project("b")]);
    expect(out.every((r) => r.membershipBadge === null)).toBe(true);
  });
});

describe("computeProjectRollup", () => {
  it("sums allocated and used SUs across rows", () => {
    const out = computeProjectRollup(
      [{ initial_su_amount: 1000 }, { initial_su_amount: 500 }],
      [{ used_su_amount: 250 }, { used_su_amount: 100 }],
    );
    expect(out.totalSu).toBe(1500);
    expect(out.usedSu).toBe(350);
    expect(out.usedPct).toBeCloseTo((350 / 1500) * 100, 5);
    expect(out.allocationsCount).toBe(2);
  });

  it("avoids divide-by-zero when no allocations are present", () => {
    const out = computeProjectRollup([], []);
    expect(out.totalSu).toBe(0);
    expect(out.usedPct).toBe(0);
  });

  it("treats undefined usage as zero", () => {
    const out = computeProjectRollup([{ initial_su_amount: 1000 }], [undefined]);
    expect(out.usedSu).toBe(0);
    expect(out.usedPct).toBe(0);
  });

  it("caps usedPct at 500 to keep transient over-100% values bounded", () => {
    const out = computeProjectRollup(
      [{ initial_su_amount: 100 }],
      [{ used_su_amount: 10_000 }],
    );
    expect(out.usedPct).toBe(500);
  });
});

describe("emptyCopyFor", () => {
  it("returns persona-specific empty copy", () => {
    expect(emptyCopyFor("researcher").description).toMatch(/ask a PI/i);
    expect(emptyCopyFor("pi").description).toMatch(/create a project/i);
    expect(emptyCopyFor("admin").heading).toBeTruthy();
  });
});
