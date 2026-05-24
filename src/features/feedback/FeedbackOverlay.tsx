"use client";

import { type PointerEvent as ReactPointerEvent, useRef } from "react";
import type { Shape, Tool } from "./types";

type Props = {
  width: number;
  height: number;
  tool: Tool;
  shapes: Shape[];
  draft: Shape | null;
  onDraftUpdate: (draft: Shape | null) => void;
  onCommitShape: (shape: Shape) => void;
};

// Single accent (portal destructive red) used for every non-redact primitive.
const ACCENT = "oklch(0.62 0.22 25)";
const REDACT = "#000";

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

export function FeedbackOverlay({
  width,
  height,
  tool,
  shapes,
  draft,
  onDraftUpdate,
  onCommitShape,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drawingId = useRef<number | null>(null);
  // Mirror draft in a ref because React batches state across rapid pointer events.
  const draftRef = useRef<Shape | null>(draft);
  draftRef.current = draft;

  const pushDraft = (next: Shape | null) => {
    draftRef.current = next;
    onDraftUpdate(next);
  };

  // Map a pointer event to image-natural coordinates via the SVG's CTM.
  const toLocal = (e: ReactPointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const sx = width / rect.width;
    const sy = height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const handlePointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const { x, y } = toLocal(e);
    const id = newId();
    if (tool === "text") {
      // window.prompt is a step back in polish but a giant step up in reliability —
      // the inline-input approach had focus/positioning failures we couldn't pin down.
      const text = window.prompt("Add a text label:");
      const trimmed = text?.trim();
      if (trimmed) onCommitShape({ id, type: "text", x, y, text: trimmed });
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // jsdom / synthetic-pointer environments may reject; safe to ignore.
    }
    drawingId.current = e.pointerId;
    if (tool === "rect" || tool === "redact") {
      pushDraft({ id, type: tool, x, y, w: 0, h: 0 });
    } else if (tool === "arrow") {
      pushDraft({ id, type: "arrow", x1: x, y1: y, x2: x, y2: y });
    } else if (tool === "pen") {
      pushDraft({ id, type: "pen", d: `M ${x.toFixed(1)},${y.toFixed(1)}` });
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingId.current !== e.pointerId) return;
    const current = draftRef.current;
    if (!current) return;
    const { x, y } = toLocal(e);
    if (current.type === "rect" || current.type === "redact") {
      pushDraft({ ...current, w: x - current.x, h: y - current.y });
    } else if (current.type === "arrow") {
      pushDraft({ ...current, x2: x, y2: y });
    } else if (current.type === "pen") {
      pushDraft({ ...current, d: `${current.d} L ${x.toFixed(1)},${y.toFixed(1)}` });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drawingId.current !== e.pointerId) return;
    drawingId.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // see setPointerCapture above
    }
    const current = draftRef.current;
    if (!current) return;
    if (current.type === "rect" || current.type === "redact") {
      const x = Math.min(current.x, current.x + current.w);
      const y = Math.min(current.y, current.y + current.h);
      const w = Math.abs(current.w);
      const h = Math.abs(current.h);
      if (w < 2 || h < 2) return pushDraft(null);
      onCommitShape({ ...current, x, y, w, h });
    } else if (current.type === "arrow") {
      if (Math.hypot(current.x2 - current.x1, current.y2 - current.y1) < 4) return pushDraft(null);
      onCommitShape(current);
    } else if (current.type === "pen") {
      if (current.d.length < 12) return pushDraft(null);
      onCommitShape(current);
    }
    pushDraft(null);
  };

  const rendered = draft ? [...shapes, draft] : shapes;

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Annotation surface"
        className="pointer-events-auto absolute inset-0 h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <title>Annotation surface</title>
        <defs>
          <marker
            id="fb-arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={ACCENT} />
          </marker>
        </defs>
        {rendered.map((s) => {
          if (s.type === "rect") {
            return (
              <rect
                key={s.id}
                x={s.x}
                y={s.y}
                width={s.w}
                height={s.h}
                fill="none"
                stroke={ACCENT}
                strokeWidth={2}
              />
            );
          }
          if (s.type === "redact") {
            return (
              <rect
                key={s.id}
                x={s.x}
                y={s.y}
                width={s.w}
                height={s.h}
                fill={REDACT}
                stroke={REDACT}
                strokeWidth={2}
              />
            );
          }
          if (s.type === "arrow") {
            return (
              <line
                key={s.id}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                stroke={ACCENT}
                strokeWidth={2}
                markerEnd="url(#fb-arrowhead)"
              />
            );
          }
          if (s.type === "pen") {
            return (
              <path
                key={s.id}
                d={s.d}
                fill="none"
                stroke={ACCENT}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            );
          }
          return (
            <text
              key={s.id}
              x={s.x}
              y={s.y}
              fill={ACCENT}
              fontSize={14}
              fontFamily="system-ui, sans-serif"
              dominantBaseline="hanging"
            >
              {s.text}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
