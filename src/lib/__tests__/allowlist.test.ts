import { describe, expect, it } from "vitest";
import { isEmailAllowed } from "../allowlist";

describe("isEmailAllowed", () => {
  it("matches an exact email present in the CSV", () => {
    expect(isEmailAllowed("alice@example.org", "alice@example.org,bob@example.org")).toBe(true);
  });

  it("matches case-insensitively on both sides", () => {
    expect(isEmailAllowed("Alice@Example.ORG", "alice@example.org,bob@example.org")).toBe(true);
    expect(isEmailAllowed("bob@example.org", "ALICE@EXAMPLE.ORG,BOB@example.org")).toBe(true);
  });

  it("returns false when the email is not in the list", () => {
    expect(isEmailAllowed("carol@example.org", "alice@example.org,bob@example.org")).toBe(false);
  });

  it("tolerates whitespace around CSV entries", () => {
    expect(
      isEmailAllowed("bob@example.org", "  alice@example.org ,   bob@example.org   "),
    ).toBe(true);
  });

  it("fails closed on empty or whitespace-only CSV", () => {
    expect(isEmailAllowed("alice@example.org", "")).toBe(false);
    expect(isEmailAllowed("alice@example.org", "   ")).toBe(false);
    expect(isEmailAllowed("alice@example.org", ",, ,,")).toBe(false);
  });

  it("fails closed when CSV is null or undefined", () => {
    expect(isEmailAllowed("alice@example.org", null)).toBe(false);
    expect(isEmailAllowed("alice@example.org", undefined)).toBe(false);
  });

  it("returns false when email is null, undefined, or empty", () => {
    expect(isEmailAllowed(null, "alice@example.org")).toBe(false);
    expect(isEmailAllowed(undefined, "alice@example.org")).toBe(false);
    expect(isEmailAllowed("", "alice@example.org")).toBe(false);
  });
});
