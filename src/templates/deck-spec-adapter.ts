import {
  type CornerRadius,
  SLIDE_H,
  SLIDE_W,
  type Deck,
  type DeckTheme,
  type Slide,
  type SlideElement,
} from "../lib/slide-schema";

type SpecPoint = { x: number; y: number };
type SpecSize = { width: number; height: number };
type SpecPaint = { color: string; opacity?: number | null };
type SpecStroke = SpecPaint & { width?: number | null; dash?: string | null };
type SpecRadius = { tl?: number | null; tr?: number | null; bl?: number | null; br?: number | null };
type SpecAlignment = {
  horizontal?: "left" | "center" | "right" | null;
  vertical?: "top" | "middle" | "bottom" | null;
} | null;

type SpecElementBase = {
  position: SpecPoint;
  size: SpecSize;
  rotation?: number | null;
  shadow?: {
    color: string;
    blur: number;
    opacity: number;
    offsetX: number;
    offsetY: number;
  } | null;
  name?: string | null;
  slot?: string;
};

type SpecTextElement = SpecElementBase & {
  type: "text";
  text: string;
  font: {
    family?: string | null;
    size: number;
    color: string;
    bold?: boolean | null;
    italic?: boolean | null;
    lineHeight?: number | null;
    letterSpacing?: number | null;
  };
  alignment?: SpecAlignment;
};

type SpecRectangleElement = SpecElementBase & {
  type: "rectangle";
  fill?: SpecPaint | null;
  stroke?: SpecStroke | null;
  borderRadius?: SpecRadius | null;
};

type SpecImageElement = SpecElementBase & {
  type: "image";
  data?: string | null;
  fit?: "contain" | "cover" | "fill" | null;
  is_icon?: boolean | null;
  borderRadius?: SpecRadius | null;
};

type SpecTableCell = {
  fill?: SpecPaint | null;
  stroke?: SpecStroke | null;
  text: string;
};

type SpecTableElement = SpecElementBase & {
  type: "table";
  columns: SpecTableCell[];
  rows: SpecTableCell[][];
};

export type DeckSpecElement =
  | SpecTextElement
  | SpecRectangleElement
  | SpecImageElement
  | SpecTableElement;

export type DeckSpecComponent = {
  id: string;
  description?: string;
  position?: SpecPoint;
  size?: SpecSize;
  elements: DeckSpecElement[];
};

export type DeckSpecComponentInstance = {
  id?: string;
  componentId?: string;
  description?: string;
  position?: SpecPoint;
  size?: SpecSize;
  elements?: DeckSpecElement[];
  overrides?: Record<string, Partial<DeckSpecElement>>;
};

export type DeckSpecLayout = {
  id: string;
  title?: string;
  description?: string;
  background?: string;
  components: DeckSpecComponentInstance[];
};

export type DeckSpec = {
  title: string;
  description?: string;
  theme?: DeckTheme;
  slideSize?: SpecSize;
  components?: DeckSpecComponent[];
  layouts: DeckSpecLayout[];
};

export type DeckComponentTemplate = {
  id: string;
  label: string;
  description?: string;
  elements: SlideElement[];
};

const DEFAULT_SPEC_SIZE: SpecSize = { width: 1280, height: 720 };

export function createDeckFromSpec(spec: DeckSpec): Deck {
  const sourceSize = spec.slideSize ?? DEFAULT_SPEC_SIZE;
  const componentMap = new Map((spec.components ?? []).map((component) => [component.id, component]));

  return {
    title: spec.title,
    description: spec.description,
    theme: spec.theme,
    slides: spec.layouts.map((layout): Slide => {
      const componentCounts = new Map<string, number>();
      return {
        title: layout.title ?? readableTitle(layout.id),
        background: stripHash(layout.background ?? spec.theme?.background ?? "FFFFFF"),
        elements: layout.components.flatMap((instance) => {
          const componentId = instance.componentId ?? instance.id ?? "component";
          const count = componentCounts.get(componentId) ?? 0;
          componentCounts.set(componentId, count + 1);
          return convertComponentInstance(instance, componentMap, sourceSize, {
            componentInstanceId: `${layout.id}:${componentId}:${count}`,
          });
        }),
      };
    }),
  };
}

export function createComponentTemplatesFromSpec(
  spec: Pick<DeckSpec, "components" | "slideSize">,
): DeckComponentTemplate[] {
  const sourceSize = spec.slideSize ?? DEFAULT_SPEC_SIZE;
  return (spec.components ?? []).map((component) => ({
    id: component.id,
    label: readableTitle(component.id),
    description: component.description,
    elements: convertComponentInstance(
      { componentId: component.id },
      new Map([[component.id, component]]),
      sourceSize,
    ),
  }));
}

function convertComponentInstance(
  instance: DeckSpecComponentInstance,
  componentMap: Map<string, DeckSpecComponent>,
  sourceSize: SpecSize,
  options: { componentInstanceId?: string } = {},
): SlideElement[] {
  const component = instance.componentId ? componentMap.get(instance.componentId) : undefined;
  const id = instance.componentId ?? instance.id;
  const elements = instance.elements ?? component?.elements;

  if (!elements) {
    throw new Error(`Deck spec component "${id ?? "unknown"}" has no elements.`);
  }

  const componentPosition = instance.position ?? component?.position ?? { x: 0, y: 0 };
  const metadata = {
    componentId: id,
    componentInstanceId: options.componentInstanceId,
    componentDescription: instance.description ?? component?.description,
  };

  return elements
    .map((element) => applyElementOverride(element, instance.overrides))
    .map((element) => convertElement(element, componentPosition, sourceSize, metadata))
    .filter((element): element is SlideElement => element != null);
}

function applyElementOverride(
  element: DeckSpecElement,
  overrides: DeckSpecComponentInstance["overrides"],
): DeckSpecElement {
  const key = element.slot ?? element.name ?? "";
  if (!key || !overrides?.[key]) return element;
  return { ...element, ...overrides[key] } as DeckSpecElement;
}

function convertElement(
  element: DeckSpecElement,
  componentPosition: SpecPoint,
  sourceSize: SpecSize,
  metadata: {
    componentId?: string;
    componentInstanceId?: string;
    componentDescription?: string;
  },
): SlideElement | null {
  const x = toSlideX(componentPosition.x + element.position.x, sourceSize);
  const y = toSlideY(componentPosition.y + element.position.y, sourceSize);
  const w = toSlideX(element.size.width, sourceSize);
  const h = toSlideY(element.size.height, sourceSize);
  const geometry = {
    position: { x, y },
    size: { width: Math.max(0.01, w), height: Math.max(0.01, h) },
  };

  if (element.type === "text") {
    const fontSize = pxToPt(element.font.size, sourceSize);
    return {
      type: "text",
      ...geometry,
      ...commonElementProps(element, sourceSize, metadata),
      runs: [{ text: element.text || " " }],
      font: {
        family: element.font.family ?? "Poppins",
        size: fontSize,
        color: stripHash(element.font.color),
        bold: element.font.bold ?? undefined,
        italic: element.font.italic ?? undefined,
        letterSpacing:
          element.font.letterSpacing != null
            ? clamp(pxToPt(element.font.letterSpacing, sourceSize) * 100, -200, 600)
            : undefined,
        lineHeight:
          element.font.lineHeight != null && element.font.size > 0
            ? clamp(element.font.lineHeight / element.font.size, 0.8, 2.2)
            : undefined,
      },
      alignment: {
        horizontal: element.alignment?.horizontal ?? undefined,
        vertical: element.alignment?.vertical ?? undefined,
      },
    };
  }

  if (element.type === "rectangle") {
    return {
      type: "rectangle",
      ...geometry,
      ...commonElementProps(element, sourceSize, metadata),
      fill: element.fill
        ? {
            color: stripHash(element.fill.color),
            opacity: element.fill.opacity ?? undefined,
          }
        : undefined,
      stroke: strokeToSlide(element.stroke),
      borderRadius: cornerRadiusToSlide(element.borderRadius, sourceSize),
    };
  }

  if (element.type === "image") {
    return {
      type: "image",
      ...geometry,
      ...commonElementProps(element, sourceSize, metadata),
      data: element.data ?? undefined,
      name: element.name ?? undefined,
      fit: element.fit ?? undefined,
      is_icon: element.is_icon ?? undefined,
      borderRadius: cornerRadiusToSlide(element.borderRadius, sourceSize),
    };
  }

  if (element.type === "table") {
    const columnCells =
      element.columns.length > 0
        ? element.columns.map((cell) => tableCellToSlide(cell, true))
        : [tableCellToSlide({ text: "" }, true)];
    const rowCells = element.rows.map((row) =>
      row.length > 0
        ? row.map((cell) => tableCellToSlide(cell))
        : [tableCellToSlide({ text: "" })],
    );
    return {
      type: "table",
      ...geometry,
      ...commonElementProps(element, sourceSize, metadata),
      font: { family: "Poppins", size: 12, color: "111827" },
      columns: columnCells,
      rows: rowCells.length > 0 ? rowCells : [[tableCellToSlide({ text: "" })]],
    };
  }

  return null;
}

function toSlideX(value: number, sourceSize: SpecSize) {
  return round((value / sourceSize.width) * SLIDE_W);
}

function toSlideY(value: number, sourceSize: SpecSize) {
  return round((value / sourceSize.height) * SLIDE_H);
}

function pxToPt(value: number, sourceSize: SpecSize) {
  return round((value / sourceSize.width) * SLIDE_W * 72);
}

function cornerRadiusToSlide(
  radius: SpecRadius | null | undefined,
  sourceSize: SpecSize,
): CornerRadius | undefined {
  if (!radius) return undefined;
  return {
    tl: radius.tl != null ? clamp(toSlideX(radius.tl, sourceSize), 0, 0.5) : 0,
    tr: radius.tr != null ? clamp(toSlideX(radius.tr, sourceSize), 0, 0.5) : 0,
    bl: radius.bl != null ? clamp(toSlideX(radius.bl, sourceSize), 0, 0.5) : 0,
    br: radius.br != null ? clamp(toSlideX(radius.br, sourceSize), 0, 0.5) : 0,
  };
}

function strokeToSlide(stroke: SpecStroke | null | undefined) {
  if (!stroke) return undefined;
  return {
    color: stripHash(stroke.color),
    opacity: stroke.opacity ?? undefined,
    width: stroke.width ?? 1,
    dash: stroke.dash ? [4, 2] : undefined,
  };
}

function tableCellToSlide(cell: SpecTableCell, isHeader = false) {
  return {
    text: cell.text,
    fill: cell.fill
      ? {
          color: stripHash(cell.fill.color),
          opacity: cell.fill.opacity ?? undefined,
        }
      : undefined,
    stroke: strokeToSlide(cell.stroke),
    font: isHeader ? { bold: true } : undefined,
  };
}

function commonElementProps(
  element: DeckSpecElement,
  sourceSize: SpecSize,
  metadata: {
    componentId?: string;
    componentInstanceId?: string;
    componentDescription?: string;
  },
) {
  return {
    rotation: element.rotation ?? undefined,
    shadow:
      "shadow" in element && element.shadow
        ? {
            color: stripHash(element.shadow.color),
            blur: toSlideX(element.shadow.blur, sourceSize),
            opacity: element.shadow.opacity,
            offsetX: toSlideX(element.shadow.offsetX, sourceSize),
            offsetY: toSlideY(element.shadow.offsetY, sourceSize),
          }
        : undefined,
    componentId: metadata.componentId,
    componentInstanceId: metadata.componentInstanceId,
    componentDescription: metadata.componentDescription,
    componentSlot: element.slot ?? element.name ?? undefined,
  };
}

function stripHash(color: string) {
  return color.replace("#", "").toUpperCase();
}

function readableTitle(id: string) {
  return id
    .replace(/^slide_?/i, "Slide ")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Number(value.toFixed(4));
}
