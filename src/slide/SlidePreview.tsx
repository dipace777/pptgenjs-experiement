import type { CSSProperties } from "react";
import { SLIDE_H, SLIDE_W, type Slide, type SlideElement } from "./spec";

// HTML approximation of a PPTX slide. 96 px/in matches CSS's "in" unit and
// keeps positions faithful to PowerPoint. Font sizes are in points in the
// spec, so we convert pt→px before applying the canvas scale; otherwise the
// preview renders fonts ~33% smaller than the exported PPTX would.
const PX_PER_IN = 96;
const PT_TO_PX = 96 / 72;
const DEFAULT_LINE_HEIGHT = 1.15;

function withHash(c: string) {
  return c.startsWith("#") ? c : `#${c}`;
}

function boxStyle(
  el: { x: number; y: number; w: number; h: number },
  scale: number,
): CSSProperties {
  return {
    position: "absolute",
    left: el.x * PX_PER_IN * scale,
    top: el.y * PX_PER_IN * scale,
    width: el.w * PX_PER_IN * scale,
    height: el.h * PX_PER_IN * scale,
  };
}

function renderElement(el: SlideElement, scale: number, idx: number) {
  if (el.kind === "rect") {
    return (
      <div
        key={idx}
        style={{
          ...boxStyle(el, scale),
          backgroundColor: withHash(el.fill),
          opacity: el.opacity ?? 1,
          borderRadius: el.rx ? el.rx * PX_PER_IN * scale : 0,
          border: el.line
            ? `${el.line.width * scale}px solid ${withHash(el.line.color)}`
            : undefined,
        }}
      />
    );
  }

  if (el.kind === "ellipse") {
    return (
      <div
        key={idx}
        style={{
          ...boxStyle(el, scale),
          backgroundColor: withHash(el.fill),
          opacity: el.opacity ?? 1,
          borderRadius: "50%",
          border: el.line
            ? `${el.line.width * scale}px solid ${withHash(el.line.color)}`
            : undefined,
        }}
      />
    );
  }

  if (el.kind === "text") {
    const justify =
      el.valign === "middle"
        ? "center"
        : el.valign === "bottom"
          ? "flex-end"
          : "flex-start";
    return (
      <div
        key={idx}
        style={{
          ...boxStyle(el, scale),
          display: "flex",
          flexDirection: "column",
          justifyContent: justify,
          textAlign: el.align ?? "left",
          color: withHash(el.color),
          opacity: el.opacity ?? 1,
          fontFamily:
            (el.fontFace ?? "Arial") +
            ", -apple-system, Helvetica, sans-serif",
          fontSize: el.fontSize * PT_TO_PX * scale,
          fontWeight: el.bold ? 700 : 400,
          fontStyle: el.italic ? "italic" : "normal",
          lineHeight: el.lineHeight ?? DEFAULT_LINE_HEIGHT,
          letterSpacing: el.charSpacing
            ? (el.charSpacing / 100) * PT_TO_PX * scale
            : undefined,
          whiteSpace: "pre-wrap",
          overflow: "hidden",
        }}
      >
        {el.text}
      </div>
    );
  }

  // bullets
  return (
    <ul
      key={idx}
      style={{
        ...boxStyle(el, scale),
        margin: 0,
        padding: 0,
        listStyle: "none",
        color: withHash(el.color),
        fontFamily:
          (el.fontFace ?? "Arial") + ", -apple-system, Helvetica, sans-serif",
        fontSize: el.fontSize * PT_TO_PX * scale,
        lineHeight: el.lineSpacingMultiple ?? 1.3,
      }}
    >
      {el.items.map((item, i) => (
        <li
          key={i}
          style={{
            display: "flex",
            // 12pt indent in pptxgenjs ≈ 12 * (96/72) px = 16px at scale 1.
            gap: 12 * (96 / 72) * scale,
            alignItems: "baseline",
            // paraSpaceAfter in pptx defaults to 4pt → match it here.
            marginBottom: 4 * (96 / 72) * scale,
          }}
        >
          <span
            style={{
              color: withHash(el.bulletColor ?? el.color),
              fontSize: el.fontSize * PT_TO_PX * scale,
              lineHeight: 1,
            }}
          >
            •
          </span>
          <span style={{ flex: 1 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

interface Props {
  slide: Slide;
  /** Visual width in CSS px; height derives from the 16:9 slide aspect. */
  width?: number;
  /** Optional drop shadow + radius. Defaults to true for main, false ok for thumbs. */
  framed?: boolean;
}

export function SlidePreview({ slide, width = 880, framed = true }: Props) {
  const scale = width / (SLIDE_W * PX_PER_IN);
  const height = SLIDE_H * PX_PER_IN * scale;

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        backgroundColor: withHash(slide.background),
        boxShadow: framed ? "0 24px 60px rgba(0,0,0,0.45)" : "none",
        borderRadius: framed ? 6 : 3,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {slide.elements.map((el, i) => renderElement(el, scale, i))}
    </div>
  );
}
