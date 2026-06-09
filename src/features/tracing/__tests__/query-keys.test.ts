import { traceKeys } from "@features/tracing/queries";
import { describe, expect, it } from "vitest";

describe("traceKeys shape", () => {
  it("exposes a stable hierarchy", () => {
    expect(traceKeys.all).toEqual(["traces"]);
    expect(traceKeys.lists()).toEqual(["traces", "list"]);
    expect(traceKeys.details()).toEqual(["traces", "detail"]);
  });

  it("nests list filters under the list root", () => {
    const filters = { source: ["amie"], status: [1], limit: 50 };
    expect(traceKeys.list(filters)).toEqual(["traces", "list", filters]);
  });

  it("nests detail ids under the detail root", () => {
    expect(traceKeys.detail("a3b1c92d3f4e5a6b7c8d9e0f12345678")).toEqual([
      "traces",
      "detail",
      "a3b1c92d3f4e5a6b7c8d9e0f12345678",
    ]);
  });

  it("namespaces stats and audit lookups distinctly", () => {
    expect(traceKeys.stats("30d")).toEqual(["traces", "stats", "30d"]);
    expect(traceKeys.audit("a3b1c92d3f4e5a6b7c8d9e0f12345678", "1000000000000006")).toEqual([
      "traces",
      "audit",
      "a3b1c92d3f4e5a6b7c8d9e0f12345678",
      "1000000000000006",
    ]);
    expect(traceKeys.audit("a3b1c92d3f4e5a6b7c8d9e0f12345678")).toEqual([
      "traces",
      "audit",
      "a3b1c92d3f4e5a6b7c8d9e0f12345678",
      null,
    ]);
  });
});
