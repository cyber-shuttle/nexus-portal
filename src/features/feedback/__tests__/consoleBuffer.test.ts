import { afterEach, describe, expect, it, vi } from "vitest";
import { createConsoleBuffer } from "../consoleBuffer";

const SYMBOL_KEY = Symbol.for("nexus.feedback.consoleBuffer.installed");

afterEach(() => {
  // Clean up the installed marker so tests are independent.
  (console as unknown as Record<symbol, unknown>)[SYMBOL_KEY] = false;
});

describe("createConsoleBuffer", () => {
  it("records error and warn calls in order", () => {
    const buf = createConsoleBuffer(10);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    buf.install();
    console.error("boom");
    console.warn("hmm");
    console.error("again");
    const snap = buf.snapshot();
    expect(snap.map((e) => e.level)).toEqual(["error", "warn", "error"]);
    expect(snap.map((e) => e.message)).toEqual(["boom", "hmm", "again"]);
    buf.uninstall();
    errSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("caps the ring at capacity, dropping oldest", () => {
    const buf = createConsoleBuffer(3);
    vi.spyOn(console, "error").mockImplementation(() => {});
    buf.install();
    console.error("a");
    console.error("b");
    console.error("c");
    console.error("d");
    expect(buf.snapshot().map((e) => e.message)).toEqual(["b", "c", "d"]);
    buf.uninstall();
  });

  it("wraps and restores console.error/warn", () => {
    const origError = console.error;
    const origWarn = console.warn;
    const buf = createConsoleBuffer();
    buf.install();
    expect(console.error).not.toBe(origError);
    expect(console.warn).not.toBe(origWarn);
    buf.uninstall();
    expect(console.error).toBe(origError);
    expect(console.warn).toBe(origWarn);
  });

  it("calls the original console methods after recording", () => {
    const inner = vi.fn();
    const origError = console.error;
    console.error = inner;
    const buf = createConsoleBuffer();
    buf.install();
    console.error("ping");
    expect(inner).toHaveBeenCalledWith("ping");
    buf.uninstall();
    console.error = origError;
  });

  it("handles circular references without throwing", () => {
    const buf = createConsoleBuffer();
    vi.spyOn(console, "error").mockImplementation(() => {});
    buf.install();
    const a: Record<string, unknown> = {};
    a.self = a;
    expect(() => console.error(a)).not.toThrow();
    const snap = buf.snapshot();
    expect(snap).toHaveLength(1);
    expect(snap[0]?.message).toBe("[unserializable]");
    buf.uninstall();
  });

  it("install is idempotent", () => {
    const buf = createConsoleBuffer();
    vi.spyOn(console, "error").mockImplementation(() => {});
    buf.install();
    const wrapped = console.error;
    buf.install();
    expect(console.error).toBe(wrapped);
    buf.uninstall();
  });

  it("truncates per-message at 2000 chars", () => {
    const buf = createConsoleBuffer();
    vi.spyOn(console, "error").mockImplementation(() => {});
    buf.install();
    console.error("x".repeat(3000));
    expect(buf.snapshot()[0]?.message).toHaveLength(2000);
    buf.uninstall();
  });

  it("clear empties the ring", () => {
    const buf = createConsoleBuffer();
    vi.spyOn(console, "error").mockImplementation(() => {});
    buf.install();
    console.error("a");
    expect(buf.snapshot()).toHaveLength(1);
    buf.clear();
    expect(buf.snapshot()).toHaveLength(0);
    buf.uninstall();
  });
});
