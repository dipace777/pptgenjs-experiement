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

  if (el.kind === "chart") {
    const max = Math.max(1, ...el.data.map((datum) => datum.value));
    const color = withHash(el.color);
    const axisColor = withHash(el.axisColor ?? "9AA7BD");
    const labelColor = withHash(el.labelColor ?? "6A7894");
    const w = el.w * PX_PER_IN * scale;
    const h = el.h * PX_PER_IN * scale;
    const top = el.title ? 28 * scale : 12 * scale;
    const pad = 14 * scale;
    const plot = {
      x: pad,
      y: top,
      w: Math.max(1, w - pad * 2),
      h: Math.max(1, h - top - pad),
    };

    const renderChart = () => {
      if (el.chartType === "donut") {
        const total = el.data.reduce((sum, datum) => sum + datum.value, 0);
        let acc = 0;
        const radius = Math.min(plot.w * 0.28, plot.h * 0.44);
        const cx = plot.x + radius + 4 * scale;
        const cy = plot.y + plot.h / 2;
        const slices = el.data.map((datum, index) => {
          const start = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += datum.value;
          const end = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = end - start > Math.PI ? 1 : 0;
          const x1 = cx + Math.cos(start) * radius;
          const y1 = cy + Math.sin(start) * radius;
          const x2 = cx + Math.cos(end) * radius;
          const y2 = cy + Math.sin(end) * radius;
          return (
            <path
              key={index}
              d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`}
              fill={withHash(datum.color ?? el.color)}
            />
          );
        });
        return (
          <>
            {slices}
            <circle cx={cx} cy={cy} r={radius * 0.54} fill="white" />
            <text
              x={cx}
              y={cy + 4 * scale}
              textAnchor="middle"
              fontSize={12 * scale}
              fontWeight={700}
              fill={color}
            >
              {total}
            </text>
            {el.data.map((datum, index) => (
              <g key={datum.label} transform={`translate(${cx + radius + 18 * scale} ${plot.y + index * 18 * scale})`}>
                <rect width={8 * scale} height={8 * scale} fill={withHash(datum.color ?? el.color)} />
                <text x={14 * scale} y={8 * scale} fontSize={8 * scale} fill={labelColor}>
                  {datum.label}
                  {el.showValues ? ` ${datum.value}` : ""}
                </text>
              </g>
            ))}
          </>
        );
      }

      if (el.chartType === "bar") {
        const gap = 8 * scale;
        const barW = Math.max(4, (plot.w - gap * (el.data.length - 1)) / el.data.length);
        return (
          <>
            <line x1={plot.x} y1={plot.y + plot.h} x2={plot.x + plot.w} y2={plot.y + plot.h} stroke={axisColor} />
            <line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y + plot.h} stroke={axisColor} />
            {el.data.map((datum, index) => {
              const barH = (datum.value / max) * plot.h * 0.82;
              const x = plot.x + index * (barW + gap);
              const y = plot.y + plot.h - barH;
              return (
                <g key={datum.label}>
                  <rect x={x} y={y} width={barW} height={barH} fill={withHash(datum.color ?? el.color)} />
                  {el.showValues ? (
                    <text x={x + barW / 2} y={y - 4 * scale} textAnchor="middle" fontSize={7 * scale} fill={labelColor}>
                      {datum.value}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </>
        );
      }

      const points = el.data.map((datum, index) => ({
        x: plot.x + (el.data.length === 1 ? 0 : (index / (el.data.length - 1)) * plot.w),
        y: plot.y + plot.h - (datum.value / max) * plot.h * 0.82,
        color: withHash(datum.color ?? el.color),
      }));
      return (
        <>
          <line x1={plot.x} y1={plot.y + plot.h} x2={plot.x + plot.w} y2={plot.y + plot.h} stroke={axisColor} />
          <line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y + plot.h} stroke={axisColor} />
          <polyline
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            stroke={color}
            strokeWidth={2 * scale}
          />
          {points.map((point, index) => (
            <circle key={index} cx={point.x} cy={point.y} r={3.5 * scale} fill={point.color} />
          ))}
        </>
      );
    };

    return (
      <div
        key={idx}
        style={{
          ...boxStyle(el, scale),
          opacity: el.opacity ?? 1,
          border: `1px solid ${axisColor}33`,
          borderRadius: 6 * scale,
          background: "rgba(255,255,255,0.92)",
          overflow: "hidden",
        }}
      >
        <svg width={w} height={h}>
          {el.title ? (
            <text x={pad} y={18 * scale} fontSize={9 * scale} fontWeight={700} fill={labelColor}>
              {el.title}
            </text>
          ) : null}
          {renderChart()}
        </svg>
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
