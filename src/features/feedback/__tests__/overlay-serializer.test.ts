import { describe, expect, it, vi } from "vitest";
import { flattenToPng, shapesToJson } from "../serializer";
import { FeedbackPayloadSchema, type Shape } from "../types";

const SAMPLE_SHAPES: Shape[] = [
  { id: "r1", type: "rect", x: 10, y: 20, w: 100, h: 50 },
  { id: "a1", type: "arrow", x1: 0, y1: 0, x2: 200, y2: 100 },
  { id: "t1", type: "text", x: 30, y: 40, text: "hello" },
  { id: "p1", type: "pen", d: "M 0,0 L 5,5 L 10,8" },
  { id: "x1", type: "redact", x: 5, y: 5, w: 80, h: 22 },
];

describe("shapesToJson", () => {
  it("packages shapes with dims under schemaVersion 1", () => {
    const out = shapesToJson(SAMPLE_SHAPES, { w: 800, h: 600 });
    expect(out).toEqual({
      schemaVersion: 1,
      imageWidth: 800,
      imageHeight: 600,
      shapes: SAMPLE_SHAPES,
    });
  });

  it("produces an annotations payload that round-trips through the zod schema", () => {
    const annotations = shapesToJson(SAMPLE_SHAPES, { w: 800, h: 600 });
    const result = FeedbackPayloadSchema.safeParse({
      comment: "ten chars min satisfied here",
      annotations,
      context: {
        route: "/projects",
        persona: "unknown",
        reporterEmail: "x@y.org",
        viewport: { w: 1440, h: 900 },
        userAgent: "test",
        buildSha: "dev",
        timestamp: new Date().toISOString(),
        consoleErrors: [],
        componentOutline: {
          pageTitle: "",
          headings: [],
          navActive: "",
          navSiblings: [],
          primaryButtons: [],
          slots: [],
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("flattenToPng", () => {
  // jsdom ships without a canvas implementation, so getContext/toBlob/Image src
  // all need stubs to exercise the function end-to-end.
  function installCanvasStubs() {
    const drawImage = vi.fn();
    const ctxStub = { drawImage } as unknown as CanvasRenderingContext2D;
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(ctxStub as unknown as RenderingContext);
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, "toBlob")
      .mockImplementation(function (this: HTMLCanvasElement, cb: BlobCallback) {
        cb(new Blob(["fake-png"], { type: "image/png" }));
      });
    const origSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      set(this: HTMLImageElement, _value: string) {
        queueMicrotask(() => this.onload?.(new Event("load")));
      },
    });
    if (typeof URL.createObjectURL !== "function") {
      URL.createObjectURL = vi.fn(() => "blob:fake");
      URL.revokeObjectURL = vi.fn();
    }
    return {
      drawImage,
      restore: () => {
        getContext.mockRestore();
        toBlob.mockRestore();
        if (origSrc) Object.defineProperty(HTMLImageElement.prototype, "src", origSrc);
      },
    };
  }

  it("resolves with a PNG Blob composed from the image and overlay", async () => {
    const { drawImage, restore } = installCanvasStubs();
    try {
      const img = new Image();
      const blob = await flattenToPng(img, SAMPLE_SHAPES, { w: 200, h: 150 });
      expect(blob.type).toBe("image/png");
      // base image draw + overlay draw
      expect(drawImage).toHaveBeenCalledTimes(2);
    } finally {
      restore();
    }
  });

  it("skips the overlay draw when there are no shapes", async () => {
    const { drawImage, restore } = installCanvasStubs();
    try {
      const img = new Image();
      const blob = await flattenToPng(img, [], { w: 100, h: 100 });
      expect(blob.type).toBe("image/png");
      expect(drawImage).toHaveBeenCalledTimes(1);
    } finally {
      restore();
    }
  });
});
