import type { Shape } from "./types";

const ACCENT = "oklch(0.62 0.22 25)";
const REDACT = "#000";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shapeToSvg(s: Shape): string {
  if (s.type === "rect")
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="none" stroke="${ACCENT}" stroke-width="2"/>`;
  if (s.type === "redact")
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${REDACT}" stroke="${REDACT}" stroke-width="2"/>`;
  if (s.type === "arrow")
    return `<line x1="${s.x1}" y1="${s.y1}" x2="${s.x2}" y2="${s.y2}" stroke="${ACCENT}" stroke-width="2" marker-end="url(#fb-arrowhead)"/>`;
  if (s.type === "pen")
    return `<path d="${s.d}" fill="none" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<text x="${s.x}" y="${s.y}" fill="${ACCENT}" font-size="14" font-family="system-ui, sans-serif" dominant-baseline="hanging">${escapeXml(s.text)}</text>`;
}

function shapesToSvgDoc(shapes: Shape[], w: number, h: number): string {
  const body = shapes.map(shapeToSvg).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><marker id="fb-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${ACCENT}"/></marker></defs>${body}</svg>`;
}

export function shapesToJson(
  shapes: Shape[],
  dims: { w: number; h: number },
): { schemaVersion: 1; imageWidth: number; imageHeight: number; shapes: Shape[] } {
  return { schemaVersion: 1, imageWidth: dims.w, imageHeight: dims.h, shapes };
}

export async function flattenToPng(
  image: HTMLImageElement,
  shapes: Shape[],
  dims: { w: number; h: number },
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = dims.w;
  canvas.height = dims.h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(image, 0, 0, dims.w, dims.h);

  if (shapes.length > 0) {
    const svg = shapesToSvgDoc(shapes, dims.w, dims.h);
    const svgBlob = new Blob([svg], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    try {
      const overlay = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("SVG overlay failed to load"));
        img.src = svgUrl;
      });
      ctx.drawImage(overlay, 0, 0, dims.w, dims.h);
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("canvas.toBlob returned null"));
    }, "image/png");
  });
}
