import {
  layout,
  layoutWithLines,
  prepare,
  prepareWithSegments,
} from "@chenglou/pretext";
import type { TextElement } from "./slide-schema";

// Reference DPI used across the editor (`PX_PER_IN` in editorUtils). Keep
// in sync — if that changes, this should too.
const PX_PER_INCH = 96;
const PT_TO_PX = PX_PER_INCH / 72;
const DEFAULT_LINE_HEIGHT = 1.15;

// Konva's text fontFamily falls back through "Arial, Helvetica, sans-serif";
// the first family is what actually drives wrapping, so that's what we
// measure against.
function defaultFontFace(face: string | null | undefined): string {
  return face && face.trim() ? face : "Arial";
}

/**
 * Measures the rendered height of a text block in inches, given the same
 * inputs that drive the Konva renderer. Pure arithmetic — no DOM reflow.
 *
 * Returns `null` if Pretext is unavailable (e.g. during SSR before fonts
 * have been sampled).
 */
export function measureTextHeightInches(
  text: string,
  fontFace: string | null | undefined,
  fontSizePt: number,
  widthInches: number,
  lineHeightMultiplier: number | null | undefined,
  charSpacingHundredthsPt: number | null | undefined,
): number | null {
  if (typeof window === "undefined") return null;
  const fontSizePx = fontSizePt * PT_TO_PX;
  const lhMul = lineHeightMultiplier ?? DEFAULT_LINE_HEIGHT;
  const lineHeightPx = fontSizePx * lhMul;
  const widthPx = widthInches * PX_PER_INCH;
  const letterSpacingPx = ((charSpacingHundredthsPt ?? 0) / 100) * PT_TO_PX;
  try {
    const prepared = prepare(text, `${fontSizePx}px ${defaultFontFace(fontFace)}`, {
      letterSpacing: letterSpacingPx || undefined,
    });
    const { height } = layout(prepared, widthPx, lineHeightPx);
    return height / PX_PER_INCH;
  } catch {
    return null;
  }
}

// Small fudge so we don't flag elements that match their box within sub-pixel
// rounding noise.
const OVERFLOW_TOLERANCE_IN = 0.01;

export function textElementOverflows(el: TextElement): boolean {
  const measured = measureTextHeightInches(
    el.text,
    el.fontFace,
    el.fontSize,
    el.w,
    el.lineHeight,
    el.charSpacing,
  );
  if (measured == null) return false;
  return measured > el.h + OVERFLOW_TOLERANCE_IN;
}

/**
 * Returns a fontSize that makes `text` fit inside a `widthInches × heightInches`
 * box, by binary-searching downward from the requested `fontSizePt`. Returns
 * the original size if it already fits, or if Pretext is unavailable.
 *
 * Used during PPTX import so labels authored to fit in PowerPoint (which
 * uses its own font metrics) don't overflow in our preview (which uses the
 * browser's). Mirrors PowerPoint's shrink-on-overflow behavior even when
 * the source didn't declare `<a:normAutofit/>` explicitly.
 *
 * Floor: 6pt (the schema minimum). Never grows the font.
 */
export function fitFontToBox(
  text: string,
  fontFace: string | null | undefined,
  fontSizePt: number,
  widthInches: number,
  heightInches: number,
  lineHeightMultiplier: number | null | undefined,
  charSpacingHundredthsPt: number | null | undefined,
): number {
  if (typeof window === "undefined") return fontSizePt;
  const measure = (size: number) =>
    measureTextHeightInches(
      text,
      fontFace,
      size,
      widthInches,
      lineHeightMultiplier,
      charSpacingHundredthsPt,
    );
  const startH = measure(fontSizePt);
  if (startH == null || startH <= heightInches) return fontSizePt;

  // Binary search between 6pt and the requested size. ~6 iterations get us
  // within 0.5pt of the largest size that fits.
  let lo = 6;
  let hi = fontSizePt;
  for (let i = 0; i < 8 && hi - lo > 0.5; i += 1) {
    const mid = (lo + hi) / 2;
    const h = measure(mid);
    if (h == null) return mid;
    if (h <= heightInches) lo = mid;
    else hi = mid;
  }
  return Math.max(6, lo);
}

/**
 * Returns the text broken into the lines Pretext would render given the
 * element's width/font/spacing. Used to pre-wrap text for PPTX export so the
 * exported deck doesn't depend on PowerPoint's wrap engine — which has
 * subtly different glyph metrics and routinely pushes a word onto a new
 * line, blowing past the box.
 *
 * Returns `[el.text]` (a single chunk) if Pretext can't run (SSR, font
 * sampling failure).
 */
export function wrapTextElementLines(el: TextElement): string[] {
  if (typeof window === "undefined") return [el.text];
  const fontSizePx = el.fontSize * PT_TO_PX;
  const lhMul = el.lineHeight ?? DEFAULT_LINE_HEIGHT;
  const lineHeightPx = fontSizePx * lhMul;
  const widthPx = el.w * PX_PER_INCH;
  const letterSpacingPx = ((el.charSpacing ?? 0) / 100) * PT_TO_PX;
  try {
    const prepared = prepareWithSegments(
      el.text,
      `${fontSizePx}px ${defaultFontFace(el.fontFace)}`,
      { letterSpacing: letterSpacingPx || undefined },
    );
    const { lines } = layoutWithLines(prepared, widthPx, lineHeightPx);
    if (!lines.length) return [el.text];
    return lines.map((line) => line.text);
  } catch {
    return [el.text];
  }
}
