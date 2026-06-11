import {
  DEFAULT_TEXT_COLOR,
  elementBox,
  elementFont,
  resizeElement,
} from "./element-model";
import {
  SLIDE_H,
  SLIDE_W,
  type Font,
  type SlideElement,
} from "./slide-schema";

const DARK_TEXT = "111827";
const LIGHT_TEXT = "F8FAFC";
const MIN_TEXT_CONTRAST = 4.5;

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function prepareDesignElementsForInsertion(
  elements: readonly SlideElement[],
  slideBackground: string,
): SlideElement[] {
  const centered = centerElementsForInsertion(elements);
  if (centered.length === 0 || hasOwnReadableSurface(centered)) return centered;
  return adaptTextContrast(centered, slideBackground);
}

function centerElementsForInsertion(
  elements: readonly SlideElement[],
): SlideElement[] {
  const copies = elements.map(cloneElement);
  if (copies.length === 0) return [];
  const bounds = boundsForElements(copies);
  const targetX = Math.max(0, (SLIDE_W - bounds.w) / 2);
  const targetY = Math.max(0, (SLIDE_H - bounds.h) / 2);
  const dx = targetX - bounds.x;
  const dy = targetY - bounds.y;
  return copies.map((element) => {
    const box = elementBox(element);
    return resizeElement(element, {
      x: box.x + dx,
      y: box.y + dy,
    });
  });
}

function adaptTextContrast(
  elements: readonly SlideElement[],
  slideBackground: string,
): SlideElement[] {
  const background = normalizeHex(slideBackground, "FFFFFF");
  return elements.map((element) => adaptElementTextContrast(element, background));
}

function adaptElementTextContrast(
  element: SlideElement,
  background: string,
): SlideElement {
  if (element.type === "text") {
    const color = normalizeHex(elementFont(element).color, DEFAULT_TEXT_COLOR);
    if (contrastRatio(color, background) >= MIN_TEXT_CONTRAST) return element;
    const nextColor = readableTextColor(background);
    return {
      ...element,
      font: withFontColor(element.font, nextColor),
      runs: element.runs.map((run) => ({
        ...run,
        font: run.font ? withFontColor(run.font, nextColor) : run.font,
      })),
    };
  }

  if (element.type === "text-list") {
    const color = normalizeHex(elementFont(element).color, DEFAULT_TEXT_COLOR);
    if (contrastRatio(color, background) >= MIN_TEXT_CONTRAST) return element;
    return {
      ...element,
      font: withFontColor(element.font, readableTextColor(background)),
    };
  }

  if (element.type === "table") {
    const nextColor = readableTextColor(background);
    const fontColor = normalizeHex(elementFont(element).color, DEFAULT_TEXT_COLOR);
    return {
      ...element,
      font:
        contrastRatio(fontColor, background) >= MIN_TEXT_CONTRAST
          ? element.font
          : withFontColor(element.font, nextColor),
      columns: element.columns.map((cell) => adaptTableCellText(cell, background)),
      rows: element.rows.map((row) =>
        row.map((cell) => adaptTableCellText(cell, background)),
      ),
    };
  }

  if (element.type === "container") {
    return {
      ...element,
      child: element.child
        ? adaptElementTextContrast(element.child, background)
        : element.child,
    };
  }

  if (element.type === "group" || element.type === "flex" || element.type === "grid") {
    return {
      ...element,
      children: element.children.map((child) =>
        adaptElementTextContrast(child, background),
      ),
    };
  }

  if (element.type === "list-view" || element.type === "grid-view") {
    return {
      ...element,
      item: adaptElementTextContrast(element.item, background),
    };
  }

  return element;
}

function adaptTableCellText<
  T extends { font?: Font | null },
>(cell: T, background: string): T {
  const color = normalizeHex(cell.font?.color ?? DEFAULT_TEXT_COLOR, DEFAULT_TEXT_COLOR);
  if (contrastRatio(color, background) >= MIN_TEXT_CONTRAST) return cell;
  return {
    ...cell,
    font: withFontColor(cell.font, readableTextColor(background)),
  };
}

function withFontColor(font: Font | null | undefined, color: string): Font {
  return { ...(font ?? {}), color };
}

function hasOwnReadableSurface(elements: readonly SlideElement[]): boolean {
  const bounds = boundsForElements(elements);
  const area = Math.max(0.01, bounds.w * bounds.h);
  return elements.some((element) => visibleSurfaceArea(element) / area >= 0.25);
}

function visibleSurfaceArea(element: SlideElement): number {
  if (element.type === "rectangle" || element.type === "ellipse") {
    if (!element.fill || element.fill.opacity === 0 || element.opacity === 0) return 0;
    return elementArea(element);
  }

  if (element.type === "container") {
    const ownArea =
      element.fill && element.fill.opacity !== 0 && element.opacity !== 0
        ? elementArea(element)
        : 0;
    return ownArea + (element.child ? visibleSurfaceArea(element.child) : 0);
  }

  if (element.type === "table") return elementArea(element);
  if (element.type === "image") return elementArea(element);

  if (element.type === "group" || element.type === "flex" || element.type === "grid") {
    return element.children.reduce(
      (sum, child) => sum + visibleSurfaceArea(child),
      0,
    );
  }

  if (element.type === "list-view" || element.type === "grid-view") {
    return visibleSurfaceArea(element.item);
  }

  return 0;
}

function boundsForElements(elements: readonly SlideElement[]): Bounds {
  if (elements.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const boxes = elements.map(elementBox);
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));
  return {
    x: minX,
    y: minY,
    w: Math.max(0.01, maxX - minX),
    h: Math.max(0.01, maxY - minY),
  };
}

function elementArea(element: SlideElement): number {
  const box = elementBox(element);
  return Math.max(0, box.w * box.h);
}

function readableTextColor(background: string): string {
  const lightContrast = contrastRatio(LIGHT_TEXT, background);
  const darkContrast = contrastRatio(DARK_TEXT, background);
  return lightContrast >= darkContrast ? LIGHT_TEXT : DARK_TEXT;
}

function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex: string): number {
  const clean = normalizeHex(hex, "000000");
  const channels = [0, 2, 4].map((start) => {
    const value = Number.parseInt(clean.slice(start, start + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function normalizeHex(color: string, fallback: string): string {
  const clean = color.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{6}$/.test(clean)) return clean;
  return fallback;
}

function cloneElement(element: SlideElement): SlideElement {
  return JSON.parse(JSON.stringify(element)) as SlideElement;
}
