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
      bold: el.bold,
      italic: el.italic,
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
