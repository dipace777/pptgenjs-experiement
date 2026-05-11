import PptxGenJS from "pptxgenjs";
import {
  SLIDE_H,
  SLIDE_W,
  type Deck,
  type Slide,
  type SlideElement,
} from "./spec";

const VALIGN = { top: "top", middle: "middle", bottom: "bottom" } as const;

function transparencyPct(opacity?: number): number {
  if (opacity == null) return 0;
  return Math.max(0, Math.min(100, Math.round((1 - opacity) * 100)));
}

function addElement(
  pptx: PptxGenJS,
  s: PptxGenJS.Slide,
  el: SlideElement,
): void {
  if (el.kind === "rect") {
    const rounded = el.rx != null && el.rx > 0;
    const shape = rounded
      ? pptx.ShapeType.roundRect
      : pptx.ShapeType.rect;
    const opts: PptxGenJS.ShapeProps = {
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      fill: { color: el.fill, transparency: transparencyPct(el.opacity) },
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
      fill: { color: el.fill, transparency: transparencyPct(el.opacity) },
      line: el.line
        ? { color: el.line.color, width: el.line.width }
        : { type: "none" },
    });
    return;
  }

  if (el.kind === "text") {
    s.addText(el.text, {
      x: el.x,
      y: el.y,
      w: el.w,
      h: el.h,
      fontFace: el.fontFace ?? "Helvetica",
      fontSize: el.fontSize,
      bold: el.bold,
      italic: el.italic,
      color: el.color,
      align: el.align ?? "left",
      valign: VALIGN[el.valign ?? "top"],
      charSpacing: el.charSpacing,
      transparency: transparencyPct(el.opacity),
      lineSpacingMultiple: el.lineHeight,
    });
    return;
  }

  // bullets
  const runs = el.items.map((t) => ({
    text: t,
    options: {
      bullet: { code: "25CF", color: el.bulletColor ?? el.color },
    },
  }));
  s.addText(runs, {
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    fontFace: el.fontFace ?? "Helvetica",
    fontSize: el.fontSize,
    color: el.color,
    valign: "top",
    paraSpaceAfter: 4,
    lineSpacingMultiple: el.lineSpacingMultiple ?? 1.3,
  });
}

function addSlide(pptx: PptxGenJS, slide: Slide): void {
  const s = pptx.addSlide();
  s.background = { color: slide.background };
  for (const el of slide.elements) addElement(pptx, s, el);
}

export async function generatePptx(deck: Deck, filename = "presentation.pptx") {
  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: "PPTY_16x9", width: SLIDE_W, height: SLIDE_H });
  pptx.layout = "PPTY_16x9";

  for (const slide of deck.slides) addSlide(pptx, slide);

  await pptx.writeFile({ fileName: filename });
}
