import PptxGenJS from "pptxgenjs";
import {
  SLIDE_H,
  SLIDE_W,
  type ChartElement,
  type Deck,
  type Slide,
  type SlideElement,
} from "./spec";

const VALIGN = { top: "top", middle: "middle", bottom: "bottom" } as const;

function transparencyPct(opacity?: number): number {
  if (opacity == null) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - opacity) * 100)));
}

// Blends `fg` over `bg` at the given opacity (Porter-Duff "over" with both
// alphas = 1). Used to bake text opacity into a solid color, because Google
// Slides ignores <a:alpha> inside text-run color elements (it only honors
// alpha on shape fills). PowerPoint renders both correctly, but baking gets us
// consistent output across PPT, Google Slides, and Keynote.
function blendHex(fg: string, bg: string, opacity: number): string {
  const a = Math.max(0, Math.min(1, opacity));
  const parse = (h: string) => [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  const [fr, fg_, fb] = parse(fg);
  const [br, bg_, bb] = parse(bg);
  const mix = (f: number, b: number) => Math.round(b + (f - b) * a);
  const toHex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return toHex(mix(fr, br)) + toHex(mix(fg_, bg_)) + toHex(mix(fb, bb));
}

function chartMax(el: ChartElement): number {
  return Math.max(1, ...el.data.map((datum) => datum.value));
}

function addLineSegment(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
) {
  const x = Math.min(from.x, to.x);
  const y = Math.min(from.y, to.y);
  const w = Math.abs(to.x - from.x);
  const h = Math.abs(to.y - from.y);
  const rises = to.y < from.y;

  s.addShape(pptx.ShapeType.line, {
    x,
    y,
    w,
    h,
    flipV: rises,
    line: { color, width: 2 },
  });
}

function addChartElement(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  el: ChartElement,
): void {
  const titleH = el.title ? 0.28 : 0;
  const pad = 0.14;
  const plot = {
    x: el.x + pad,
    y: el.y + pad + titleH,
    w: el.w - pad * 2,
    h: el.h - pad * 2 - titleH - 0.18,
  };
  const axisColor = el.axisColor ?? "9AA7BD";
  const labelColor = el.labelColor ?? "6A7894";
  const max = chartMax(el);

  s.addShape(pptx.ShapeType.roundRect, {
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    rectRadius: 0.04,
    fill: { color: "FFFFFF", transparency: transparencyPct(el.opacity ?? 0.92) },
    line: { color: axisColor, transparency: 80 },
  });

  if (el.title) {
    s.addText(el.title, {
      x: el.x + pad,
      y: el.y + 0.08,
      w: el.w - pad * 2,
      h: 0.22,
      fontFace: "Arial",
      fontSize: 9,
      bold: true,
      color: labelColor,
      margin: 0,
    });
  }

  if (el.chartType === "donut") {
    const size = Math.min(plot.w, plot.h);
    const cx = plot.x + size * 0.04;
    const cy = plot.y + (plot.h - size) / 2;
    s.addShape(pptx.ShapeType.donut, {
      x: cx,
      y: cy,
      w: size,
      h: size,
      fill: { color: el.data[0]?.color ?? el.color },
      line: { type: "none" },
    });
    s.addText(String(el.data.reduce((sum, datum) => sum + datum.value, 0)), {
      x: cx + size * 0.22,
      y: cy + size * 0.35,
      w: size * 0.56,
      h: size * 0.22,
      fontFace: "Arial",
      fontSize: 10,
      bold: true,
      color: el.color,
      align: "center",
      margin: 0,
    });

    el.data.forEach((datum, index) => {
      const y = plot.y + index * 0.24;
      s.addShape(pptx.ShapeType.rect, {
        x: plot.x + size + 0.16,
        y,
        w: 0.1,
        h: 0.1,
        fill: { color: datum.color ?? el.color },
        line: { type: "none" },
      });
      s.addText(`${datum.label}${el.showValues ? ` ${datum.value}` : ""}`, {
        x: plot.x + size + 0.3,
        y: y - 0.02,
        w: Math.max(0.2, plot.w - size - 0.34),
        h: 0.16,
        fontFace: "Arial",
        fontSize: 7,
        color: labelColor,
        margin: 0,
      });
    });
    return;
  }

  s.addShape(pptx.ShapeType.line, {
    x: plot.x,
    y: plot.y + plot.h,
    w: plot.w,
    h: 0,
    line: { color: axisColor, width: 0.75 },
  });
  s.addShape(pptx.ShapeType.line, {
    x: plot.x,
    y: plot.y,
    w: 0,
    h: plot.h,
    line: { color: axisColor, width: 0.75 },
  });

  if (el.chartType === "bar") {
    const gap = 0.08;
    const barW = Math.max(0.08, (plot.w - gap * (el.data.length - 1)) / el.data.length);
    el.data.forEach((datum, index) => {
      const h = (datum.value / max) * (plot.h * 0.82);
      const x = plot.x + index * (barW + gap);
      const y = plot.y + plot.h - h;
      s.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: barW,
        h,
        fill: { color: datum.color ?? el.color },
        line: { type: "none" },
      });
      if (el.showValues) {
        s.addText(String(datum.value), {
          x,
          y: y - 0.16,
          w: barW,
          h: 0.13,
          fontFace: "Arial",
          fontSize: 6.5,
          color: labelColor,
          align: "center",
          margin: 0,
        });
      }
    });
    return;
  }

  const points = el.data.map((datum, index) => ({
    x: plot.x + (el.data.length === 1 ? 0 : (index / (el.data.length - 1)) * plot.w),
    y: plot.y + plot.h - (datum.value / max) * (plot.h * 0.82),
    color: datum.color ?? el.color,
  }));
  points.slice(1).forEach((point, index) => {
    const prev = points[index];
    addLineSegment(pptx, s, prev, point, el.color);
  });
  points.forEach((point) => {
    s.addShape(pptx.ShapeType.ellipse, {
      x: point.x - 0.035,
      y: point.y - 0.035,
      w: 0.07,
      h: 0.07,
      fill: { color: point.color },
      line: { color: "FFFFFF", width: 0.5 },
    });
  });
}

function addTableElement(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  el: Extract<SlideElement, { kind: "table" }>,
): void {
  const rows = el.rows;
  const cols = Math.max(1, ...rows.map((row) => row.length));
  const rowH = el.h / rows.length;
  const colW = el.w / cols;
  const fill = el.fill ?? "FFFFFF";

  s.addShape(pptx.ShapeType.roundRect, {
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    rectRadius: 0.025,
    fill: { color: fill, transparency: transparencyPct(el.opacity ?? undefined) },
    line: { color: el.borderColor, width: 0.75 },
  });

  rows.forEach((row, rowIndex) => {
    Array.from({ length: cols }).forEach((_, colIndex) => {
      const isHeader = rowIndex === 0;
      const x = el.x + colIndex * colW;
      const y = el.y + rowIndex * rowH;
      s.addShape(pptx.ShapeType.rect, {
        x,
        y,
        w: colW,
        h: rowH,
        fill: {
          color: isHeader ? el.headerFill : fill,
          transparency: transparencyPct(el.opacity ?? undefined),
        },
        line: { color: el.borderColor, width: 0.5 },
      });
      s.addText(row[colIndex] ?? "", {
        x: x + 0.08,
        y: y + 0.05,
        w: Math.max(0.1, colW - 0.16),
        h: Math.max(0.1, rowH - 0.1),
        fontFace: el.fontFace ?? "Arial",
        fontSize: el.fontSize,
        bold: isHeader,
        color: isHeader ? el.headerTextColor : el.textColor,
        align: colIndex === 0 ? "left" : "center",
        valign: "middle",
        fit: "shrink",
        margin: 0,
      });
    });
  });
}

function addGridElement(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  el: Extract<SlideElement, { kind: "grid" }>,
): void {
  const columns = Math.max(1, el.columns);
  const rows = Math.max(1, Math.ceil(el.items.length / columns));
  const gap = el.gap ?? 0.12;
  const cellW = (el.w - gap * (columns - 1)) / columns;
  const cellH = (el.h - gap * (rows - 1)) / rows;

  el.items.forEach((item, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = el.x + col * (cellW + gap);
    const y = el.y + row * (cellH + gap);
    const isChart = item.type === "chart";
    const isImage = item.type === "image";
    const chartType = item.chartType ?? "bar";
    s.addShape(pptx.ShapeType.roundRect, {
      x,
      y,
      w: cellW,
      h: cellH,
      rectRadius: Math.min(0.2, (el.rx ?? 0.08) / Math.min(cellW, cellH)),
      fill: {
        color: el.fill,
        transparency: transparencyPct(el.opacity ?? undefined),
      },
      line: { color: el.borderColor, width: 0.75 },
    });

    if (isChart) {
      addGridChartIcon(pptx, s, chartType, x, y, cellW, cellH, el.numberColor);
    }

    if (isImage) {
      s.addShape(pptx.ShapeType.rect, {
        x: x + cellW * 0.18,
        y: y + cellH * 0.27,
        w: cellW * 0.64,
        h: cellH * 0.32,
        fill: { transparency: 100 },
        line: { color: el.numberColor, width: 0.9 },
      });
      s.addShape(pptx.ShapeType.line, {
        x: x + cellW * 0.22,
        y: y + cellH * 0.54,
        w: cellW * 0.54,
        h: -cellH * 0.2,
        flipV: true,
        line: { color: el.numberColor, width: 0.9 },
      });
    }

    s.addText(item.title, {
      x,
      y: y + (isChart || isImage ? cellH * 0.08 : cellH * 0.16),
      w: cellW,
      h: isChart || isImage ? cellH * 0.22 : cellH * 0.46,
      fontFace: el.fontFace ?? "Arial",
      fontSize: isChart || isImage ? el.numberFontSize * 0.72 : el.numberFontSize,
      bold: true,
      color: el.numberColor,
      align: "center",
      valign: "middle",
      margin: 0,
      fit: "shrink",
    });
    s.addText(item.subtitle || item.type.toUpperCase(), {
      x: x + cellW * 0.1,
      y: y + cellH * 0.68,
      w: cellW * 0.8,
      h: cellH * 0.18,
      fontFace: el.fontFace ?? "Arial",
      fontSize: el.labelFontSize,
      bold: true,
      color: el.labelColor,
      align: "center",
      margin: 0,
      fit: "shrink",
      charSpacing: 1.7,
    });
  });
}

function addGridChartIcon(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  chartType: "bar" | "line" | "pie" | "donut",
  x: number,
  y: number,
  cellW: number,
  cellH: number,
  color: string,
) {
  if (chartType === "bar") {
    [0.18, 0.26, 0.34].forEach((height, index) => {
      s.addShape(pptx.ShapeType.rect, {
        x: x + cellW * (0.22 + index * 0.2),
        y: y + cellH * (0.76 - height),
        w: cellW * 0.12,
        h: cellH * height,
        fill: { color, transparency: index * 16 },
        line: { type: "none" },
      });
    });
    return;
  }

  if (chartType === "pie" || chartType === "donut") {
    const size = Math.min(cellW, cellH) * 0.34;
    s.addShape(
      chartType === "donut" ? pptx.ShapeType.donut : pptx.ShapeType.pie,
      {
        x: x + cellW * 0.5 - size / 2,
        y: y + cellH * 0.46 - size / 2,
        w: size,
        h: size,
        fill: { color },
        line: { type: "none" },
      },
    );
    return;
  }

  const points = [
    [x + cellW * 0.18, y + cellH * 0.62],
    [x + cellW * 0.4, y + cellH * 0.46],
    [x + cellW * 0.62, y + cellH * 0.54],
    [x + cellW * 0.82, y + cellH * 0.32],
  ];
  points.slice(1).forEach((point, pointIndex) => {
    const prev = points[pointIndex];
    s.addShape(pptx.ShapeType.line, {
      x: Math.min(prev[0], point[0]),
      y: Math.min(prev[1], point[1]),
      w: Math.abs(point[0] - prev[0]),
      h: Math.abs(point[1] - prev[1]),
      flipV: point[1] < prev[1],
      line: { color, width: 1.2 },
    });
  });
}

function addElement(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  el: SlideElement,
  bg: string,
): void {
  if (el.kind === "rect") {
    const rounded = el.rx != null && el.rx > 0;
    const shape = rounded ? pptx.ShapeType.roundRect : pptx.ShapeType.rect;
    const opts: PptxGenJS.ShapeProps = {
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      fill: {
        color: el.fill,
        transparency: transparencyPct(el.opacity ?? undefined),
      },
      line: el.line
        ? { color: el.line.color, width: el.line.width }
        : { type: "none" },
    };
    if (rounded) {
      // pptxgenjs rectRadius is a fraction of the shorter side / 2.
      opts.rectRadius = Math.min(0.5, (el.rx as number) / Math.min(el.w, el.h));
    }
    s.addShape(shape, opts);
    return;
  }

  if (el.kind === "ellipse") {
    s.addShape(pptx.ShapeType.ellipse, {
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      fill: {
        color: el.fill,
        transparency: transparencyPct(el.opacity ?? undefined),
      },
      line: el.line
        ? { color: el.line.color, width: el.line.width }
        : { type: "none" },
    });
    return;
  }

  if (el.kind === "text") {
    const color =
      el.opacity != null && el.opacity < 1
        ? blendHex(el.color, bg, el.opacity)
        : el.color;
    s.addText(el.text, {
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      fontFace: el.fontFace ?? "Arial",
      fontSize: el.fontSize,
      bold: el.bold ?? undefined,
      italic: el.italic ?? undefined,
      color,
      align: el.align ?? "left",
      valign: VALIGN[el.valign ?? "top"],
      // Spec uses hundredths-of-a-point (matches OOXML's `spc` unit and our
      // CSS letter-spacing math). pptxgenjs takes points directly, so divide.
      charSpacing: el.charSpacing != null ? el.charSpacing / 100 : undefined,
      // Use absolute line height in points (= multiplier × fontSize) so PPTX
      // matches CSS's `line-height: X` (also a multiplier of fontSize).
      lineSpacing: (el.lineHeight ?? 1.15) * el.fontSize,
      // Zero the text-frame inset so coordinates match the React preview
      // (which has no padding inside its boxes).
      margin: 0,
    });
    return;
  }

  if (el.kind === "chart") {
    addChartElement(pptx, s, el);
    return;
  }

  if (el.kind === "table") {
    addTableElement(pptx, s, el);
    return;
  }

  if (el.kind === "grid") {
    addGridElement(pptx, s, el);
    return;
  }

  // bullets
  const runs = el.items.map((t) => ({
    text: t,
    options: {
      bullet: {
        code: "2022", // BULLET (smaller dot — matches the React preview)
        indent: 12,
        color: el.bulletColor ?? el.color,
      },
    },
  }));
  s.addText(runs, {
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    fontFace: el.fontFace ?? "Arial",
    fontSize: el.fontSize,
    color: el.color,
    valign: "top",
    paraSpaceAfter: 4,
    paraSpaceBefore: 0,
    lineSpacing: (el.lineSpacingMultiple ?? 1.3) * el.fontSize,
    margin: 0,
  });
}

function addSlide(pptx: PptxGenJS, slide: Slide): void {
  const s = pptx.addSlide();
  s.background = { color: slide.background };
  for (const el of slide.elements) addElement(pptx, s, el, slide.background);
}

export async function generatePptx(deck: Deck, filename = "presentation.pptx") {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PPTY_16x9", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "PPTY_16x9";

  for (const slide of deck.slides) addSlide(pptx, slide);

  await pptx.writeFile({ fileName: filename });
}
