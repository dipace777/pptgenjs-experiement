import PptxGenJS from "pptxgenjs";
import {
  SLIDE_H,
  SLIDE_W,
  type ChartElement,
  type Deck,
  type Slide,
  type SlideElement,
} from "../lib/slide-schema";

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

function addChartElement(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  el: ChartElement,
): void {
  const axisColor = el.axisColor ?? "9AA7BD";
  const labelColor = el.labelColor ?? "6A7894";
  const chartType =
    el.chartType === "donut"
      ? pptx.ChartType.doughnut
      : el.chartType === "line"
        ? pptx.ChartType.line
        : pptx.ChartType.bar;
  const labels = el.data.map((datum) => datum.label);
  const values = el.data.map((datum) => datum.value);
  const chartColors = el.data.map((datum) => datum.color ?? el.color);
  const isDonut = el.chartType === "donut";
  const data: PptxGenJS.OptsChartData[] = [
    {
      name: el.title ?? "Series",
      labels,
      values,
    },
  ];
  const options: PptxGenJS.IChartOpts = {
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    altText: el.title ?? "Chart",
    barDir: "col",
    barGapWidthPct: 70,
    chartArea: {
      fill: { color: "FFFFFF", transparency: transparencyPct(el.opacity ?? 0.92) },
      border: { color: axisColor, pt: 0.25 },
      roundedCorners: true,
    },
    chartColors,
    dataLabelColor: labelColor,
    dataLabelFontFace: "Arial",
    dataLabelFontSize: isDonut ? 7 : 6.5,
    dataLabelPosition: isDonut ? "bestFit" : "outEnd",
    holeSize: 62,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 5,
    lineSize: 2,
    lineSmooth: false,
    plotArea: {
      fill: { transparency: 100 },
      border: { type: "none" },
    },
    showLabel: isDonut,
    showLegend: isDonut,
    showTitle: Boolean(el.title),
    showValue: el.showValues ?? false,
    title: el.title ?? undefined,
    titleBold: true,
    titleColor: labelColor,
    titleFontFace: "Arial",
    titleFontSize: 9,
    valAxisHidden: isDonut,
    catAxisHidden: isDonut,
    valAxisLabelColor: labelColor,
    catAxisLabelColor: labelColor,
    valAxisLabelFontFace: "Arial",
    catAxisLabelFontFace: "Arial",
    valAxisLabelFontSize: 7,
    catAxisLabelFontSize: 7,
    valAxisLineColor: axisColor,
    catAxisLineColor: axisColor,
    valAxisLineSize: 0.75,
    catAxisLineSize: 0.75,
    valGridLine: { color: axisColor, size: 0.5, style: "dot" },
    legendColor: labelColor,
    legendFontFace: "Arial",
    legendFontSize: 7,
    legendPos: "r",
  };

  s.addChart(chartType, data, options);
}

function addTableElement(
  s: PptxGenJS.Slide,
  el: Extract<SlideElement, { kind: "table" }>,
): void {
  const rows = el.rows;
  const cols = Math.max(1, ...rows.map((row) => row.length));
  const rowH = el.h / rows.length;
  const colW = el.w / cols;
  const fill = el.fill ?? "FFFFFF";
  const tableRows: PptxGenJS.TableRow[] = rows.map((row, rowIndex) =>
    Array.from({ length: cols }).map((_, colIndex) => {
      const isHeader = rowIndex === 0;
      return {
        text: row[colIndex] ?? "",
        options: {
          bold: isHeader,
          border: { color: el.borderColor, pt: 0.5 },
          color: isHeader ? el.headerTextColor : el.textColor,
          fill: {
            color: isHeader ? el.headerFill : fill,
            transparency: transparencyPct(el.opacity ?? undefined),
          },
          fontFace: el.fontFace ?? "Arial",
          fontSize: el.fontSize,
          fit: "shrink",
          margin: [0.05, 0.08, 0.05, 0.08],
          valign: "middle",
          align: colIndex === 0 ? "left" : "center",
        },
      };
    }),
  );

  s.addTable(tableRows, {
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    border: { color: el.borderColor, pt: 0.5 },
    colW: Array.from({ length: cols }, () => colW),
    fill: { color: fill, transparency: transparencyPct(el.opacity ?? undefined) },
    fontFace: el.fontFace ?? "Arial",
    fontSize: el.fontSize,
    margin: [0.05, 0.08, 0.05, 0.08],
    rowH: Array.from({ length: rows.length }, () => rowH),
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
    addTableElement(s, el);
    return;
  }

  if (el.kind === "image") {
    if (el.data) {
      s.addImage({
        data: el.data,
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        sizing:
          el.fit === "cover"
            ? { type: "cover", w: el.w, h: el.h }
            : el.fit === "fill"
              ? undefined
              : { type: "contain", w: el.w, h: el.h },
        transparency: transparencyPct(el.opacity ?? undefined),
      });
    } else {
      s.addShape(pptx.ShapeType.rect, {
        x: el.x,
        y: el.y,
        w: el.w,
        h: el.h,
        fill: { transparency: 100 },
        line: { color: "7D89A3", width: 0.75, dashType: "dash" },
      });
    }
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
    paraSpaceAfter: (el.itemGap ?? 0.05) * 72,
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
