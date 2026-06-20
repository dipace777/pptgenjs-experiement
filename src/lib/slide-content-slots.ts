import {
  elementBox,
  tableRowsAsStrings,
  textContent,
  textListStrings,
} from "./element-model";
import type { ChartType, Slide, SlideElement } from "./slide-schema";

export const CHART_MAX_POINTS = 8;
export const TABLE_MAX_COLUMNS = 6;
export const TABLE_MAX_ROWS = 7;

const IMAGE_CONTENT_MIN_SIZE = 1;

export type SlideContentKind = "text" | "list" | "table" | "chart" | "image";

export type SlideContentSlot =
  | { index: number; key: string; kind: "text"; text: string }
  | { index: number; items: string[]; key: string; kind: "list" }
  | {
      columns: string[];
      index: number;
      key: string;
      kind: "table";
      rows: string[][];
    }
  | {
      chartType: ChartType;
      data: Array<{ label: string; value: number }>;
      index: number;
      key: string;
      kind: "chart";
      title?: string;
    }
  | { index: number; key: string; kind: "image"; name?: string };

export type SlideContentElement = Extract<
  SlideElement,
  { type: "chart" | "image" | "table" | "text" | "text-list" }
>;

type SlotCounts = Map<SlideContentKind, number>;
type UnkeyedSlideContentSlot =
  | { kind: "text"; text: string }
  | { items: string[]; kind: "list" }
  | { columns: string[]; kind: "table"; rows: string[][] }
  | {
      chartType: ChartType;
      data: Array<{ label: string; value: number }>;
      kind: "chart";
      title?: string;
    }
  | { kind: "image"; name?: string };

export function getSlideContentSlots(slide: Pick<Slide, "elements">) {
  const counts: SlotCounts = new Map();
  const slots: SlideContentSlot[] = [];

  for (const element of slide.elements) {
    collectElementContentSlots(element, counts, slots);
  }

  return slots;
}

export function mapSlideContentElements(
  elements: SlideElement[],
  mapper: (
    element: SlideContentElement,
    slot: SlideContentSlot,
  ) => SlideContentElement,
): SlideElement[] {
  const counts: SlotCounts = new Map();
  return elements.map((element) =>
    mapElementContentSlots(element, counts, mapper),
  );
}

export function normalizeContentText(value: string | null | undefined): string {
  return value?.replace(/\r\n?/g, "\n").trim() ?? "";
}

export function slidePropertyName(slideIndex: number): string {
  return `slide_${slideIndex + 1}`;
}

function collectElementContentSlots(
  element: SlideElement,
  counts: SlotCounts,
  slots: SlideContentSlot[],
) {
  const slot = contentSlotFromElement(element);
  if (slot) {
    slots.push(keySlot(slot, counts));
    return;
  }

  switch (element.type) {
    case "container":
      if (element.child) collectElementContentSlots(element.child, counts, slots);
      return;
    case "flex":
    case "grid":
    case "group":
      element.children.forEach((child) =>
        collectElementContentSlots(child, counts, slots),
      );
      return;
    case "list-view":
    case "grid-view":
      collectElementContentSlots(element.item, counts, slots);
      return;
    case "ellipse":
    case "line":
    case "rectangle":
    case "svg":
      return;
  }
}

function mapElementContentSlots(
  element: SlideElement,
  counts: SlotCounts,
  mapper: (
    element: SlideContentElement,
    slot: SlideContentSlot,
  ) => SlideContentElement,
): SlideElement {
  const slot = contentSlotFromElement(element);
  if (slot && isSlideContentElement(element)) {
    return mapper(element, keySlot(slot, counts));
  }

  switch (element.type) {
    case "container":
      return {
        ...element,
        child: element.child
          ? mapElementContentSlots(element.child, counts, mapper)
          : element.child,
      };
    case "flex":
    case "grid":
    case "group":
      return {
        ...element,
        children: element.children.map((child) =>
          mapElementContentSlots(child, counts, mapper),
        ),
      };
    case "list-view":
    case "grid-view":
      return {
        ...element,
        item: mapElementContentSlots(element.item, counts, mapper),
      };
    case "ellipse":
    case "line":
    case "rectangle":
    case "svg":
      return element;
  }

  return element;
}

function keySlot(
  slot: UnkeyedSlideContentSlot,
  counts: SlotCounts,
): SlideContentSlot {
  const index = (counts.get(slot.kind) ?? 0) + 1;
  counts.set(slot.kind, index);

  return {
    ...slot,
    index,
    key: `${slot.kind}_${index}`,
  } as SlideContentSlot;
}

function contentSlotFromElement(
  element: SlideElement,
): UnkeyedSlideContentSlot | null {
  switch (element.type) {
    case "text":
      return textSlot(element);
    case "text-list":
      return listSlot(element);
    case "table":
      return tableSlot(element);
    case "chart":
      return chartSlot(element);
    case "image":
      return imageSlot(element);
    case "container":
    case "ellipse":
    case "flex":
    case "grid":
    case "grid-view":
    case "group":
    case "line":
    case "list-view":
    case "rectangle":
    case "svg":
      return null;
  }
}

function isSlideContentElement(
  element: SlideElement,
): element is SlideContentElement {
  return (
    element.type === "chart" ||
    element.type === "image" ||
    element.type === "table" ||
    element.type === "text" ||
    element.type === "text-list"
  );
}

function textSlot(
  element: Extract<SlideElement, { type: "text" }>,
): UnkeyedSlideContentSlot | null {
  const text = normalizeContentText(textContent(element));
  return text ? { kind: "text", text } : null;
}

function listSlot(
  element: Extract<SlideElement, { type: "text-list" }>,
): UnkeyedSlideContentSlot | null {
  const items = textListStrings(element).map(normalizeContentText).filter(Boolean);
  return items.length > 0 ? { kind: "list", items } : null;
}

function tableSlot(
  element: Extract<SlideElement, { type: "table" }>,
): UnkeyedSlideContentSlot | null {
  const [columns = [], ...rows] = tableRowsAsStrings(element).map((row) =>
    row.map(normalizeContentText),
  );
  const columnCount = clampCount(
    Math.max(columns.length, ...rows.map((row) => row.length), 1),
    1,
    TABLE_MAX_COLUMNS,
  );
  const normalizedColumns = padRow(columns, columnCount);
  const normalizedRows = rows
    .slice(0, TABLE_MAX_ROWS)
    .map((row) => padRow(row, columnCount));
  const hasContent =
    normalizedColumns.some(Boolean) ||
    normalizedRows.some((row) => row.some(Boolean));

  return hasContent
    ? { kind: "table", columns: normalizedColumns, rows: normalizedRows }
    : null;
}

function chartSlot(
  element: Extract<SlideElement, { type: "chart" }>,
): UnkeyedSlideContentSlot | null {
  const title = normalizeContentText(element.title);
  const data = element.data.map(({ label, value }) => ({
    label: normalizeContentText(label),
    value,
  }));

  return data.length > 0
    ? {
        kind: "chart",
        chartType: element.chartType,
        ...(title ? { title } : {}),
        data,
      }
    : null;
}

function imageSlot(
  element: Extract<SlideElement, { type: "image" }>,
): UnkeyedSlideContentSlot | null {
  if (element.is_icon) return null;
  const box = elementBox(element);
  if (box.w < IMAGE_CONTENT_MIN_SIZE && box.h < IMAGE_CONTENT_MIN_SIZE) {
    return null;
  }

  const name = normalizeContentText(element.name);
  if (!name && !element.data) return null;
  return { kind: "image", ...(name ? { name } : {}) };
}

function padRow(row: string[], length: number): string[] {
  return Array.from({ length }, (_value, index) => row[index] ?? "");
}

function clampCount(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
