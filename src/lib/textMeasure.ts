import { prepare, layout } from "@chenglou/pretext";
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
