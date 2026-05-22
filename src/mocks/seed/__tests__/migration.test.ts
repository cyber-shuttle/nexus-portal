import { describe, expect, it } from "vitest";
import { buildSeed, mergeHydrated } from "../index";

describe("mergeHydrated", () => {
  it("returns the fresh seed when nothing was hydrated", () => {
    const fresh = buildSeed();
    const out = mergeHydrated(fresh, null);
    expect(out).toBe(fresh);
  });

  it("preserves hydrated arrays while backfilling missing top-level fields", () => {
    const fresh = buildSeed();
    const stale = { ...fresh, amiePackets: undefined, amieEvents: undefined } as unknown as Partial<
      typeof fresh
    >;
    delete (stale as Record<string, unknown>).amiePackets;
    delete (stale as Record<string, unknown>).amieEvents;
    // Pretend the user mutated proposals in a prior session.
    const first = fresh.proposals[0];
    if (!first) throw new Error("seed has no proposals");
    const mutatedProposals = [first];
    (stale as { proposals?: typeof fresh.proposals }).proposals = mutatedProposals;

    const out = mergeHydrated(fresh, stale);

    expect(out.proposals).toBe(mutatedProposals);
    expect(Array.isArray(out.amiePackets)).toBe(true);
    expect(out.amiePackets.length).toBeGreaterThan(0);
    expect(Array.isArray(out.amieEvents)).toBe(true);
  });

  it("rejects non-object hydrated values", () => {
    const fresh = buildSeed();
    // @ts-expect-error — exercising defensive branch
    expect(mergeHydrated(fresh, 7)).toBe(fresh);
    // @ts-expect-error — exercising defensive branch
    expect(mergeHydrated(fresh, "")).toBe(fresh);
  });
});
