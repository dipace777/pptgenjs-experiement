import {
  elementBox,
  tableRowsAsStrings,
  textContent,
  textListStrings,
} from "./element-model";
import type { ChartType, Deck, Slide, SlideElement } from "./slide-schema";

const JSON_SCHEMA_DRAFT = "https://json-schema.org/draft/2020-12/schema";
const DESCRIPTION_LIMIT = 320;
const CHART_MAX_POINTS = 8;
const TABLE_MAX_COLUMNS = 6;
const TABLE_MAX_ROWS = 7;
const IMAGE_CONTENT_MIN_SIZE = 1;

export type JsonSchema =
  | JsonSchemaObject
  | JsonSchemaArray
  | JsonSchemaString
  | JsonSchemaNumber;

export type JsonSchemaObject = JsonSchemaBase & {
  additionalProperties: false;
  properties: Record<string, JsonSchema>;
  required: string[];
  type: "object";
};

export type JsonSchemaArray = JsonSchemaBase & {
  items: JsonSchema;
  maxItems?: number;
  minItems?: number;
  type: "array";
};

export type JsonSchemaString = JsonSchemaBase & {
  enum?: string[];
  type: "string";
};

export type JsonSchemaNumber = JsonSchemaBase & {
  type: "number";
};

type JsonSchemaBase = {
  $schema?: string;
  default?: unknown;
  description?: string;
  examples?: unknown[];
  title?: string;
};

type ContentSlot =
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

export function generateDeckContentJsonSchema(deck: Deck): JsonSchemaObject {
  const slideProperties = Object.fromEntries(
    deck.slides.map((slide, index) => [
      slidePropertyName(index),
      buildSlideContentJsonSchema(slide, index, false),
    ]),
  );
  const slideKeys = Object.keys(slideProperties);

  return {
    $schema: JSON_SCHEMA_DRAFT,
    title: `${normalizeText(deck.title) || "Untitled deck"} content schema`,
    description:
      "Content-only JSON Schema for LLM output. Fill the slide content slots only; do not include layout, styling, design elements, coordinates, or image data.",
    type: "object",
    additionalProperties: false,
    properties: slideProperties,
    required: slideKeys,
  };
}

export function generateSlideContentJsonSchemas(
  deck: Deck,
): JsonSchemaObject[] {
  return deck.slides.map((slide, index) =>
    generateSlideContentJsonSchema(slide, index),
  );
}

export function generateSlideContentJsonSchema(
  slide: Slide,
  slideIndex = 0,
): JsonSchemaObject {
  return buildSlideContentJsonSchema(slide, slideIndex, true);
}

function buildSlideContentJsonSchema(
  slide: Slide,
  slideIndex: number,
  includeSchemaKeyword: boolean,
): JsonSchemaObject {
  const slots = slide.elements.flatMap(contentSlotsFromElement);
  const counts = new Map<ContentSlot["kind"], number>();
  const properties: Record<string, JsonSchema> = {};

  for (const slot of slots) {
    const nextCount = (counts.get(slot.kind) ?? 0) + 1;
    counts.set(slot.kind, nextCount);
    properties[`${slot.kind}_${nextCount}`] = jsonSchemaForSlot(
      slot,
      nextCount,
    );
  }

  const slideTitle = normalizeText(slide.title);
  return {
    ...(includeSchemaKeyword ? { $schema: JSON_SCHEMA_DRAFT } : {}),
    title: slideTitle
      ? `Slide ${slideIndex + 1}: ${slideTitle} content schema`
      : `Slide ${slideIndex + 1} content schema`,
    description:
      "Content-only JSON Schema for this slide. Return values for these slots only; omit layout, styling, design elements, coordinates, and image data.",
    type: "object",
    additionalProperties: false,
    properties,
    required: Object.keys(properties),
  };
}

function contentSlotsFromElement(element: SlideElement): ContentSlot[] {
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
      return element.child ? contentSlotsFromElement(element.child) : [];
    case "flex":
    case "grid":
    case "group":
      return element.children.flatMap(contentSlotsFromElement);
    case "list-view":
    case "grid-view":
      return contentSlotsFromElement(element.item);
    case "ellipse":
    case "line":
    case "rectangle":
    case "svg":
      return [];
  }
}

function jsonSchemaForSlot(slot: ContentSlot, index: number): JsonSchema {
  switch (slot.kind) {
    case "text":
      return {
        title: `Text ${index}`,
        description: currentValueDescription("Text content", slot.text),
        type: "string",
      };
    case "list":
      return {
        title: `List ${index}`,
        description: currentValueDescription(
          `List content. Keep ${slot.items.length} items unless the prompt explicitly asks for a different count`,
          slot.items.join(" | "),
        ),
        type: "array",
        minItems: slot.items.length,
        maxItems: slot.items.length,
        items: { type: "string" },
      };
    case "table": {
      const defaultTable = {
        columns: slot.columns,
        rows: slot.rows,
      };
      return {
        title: `Table ${index}`,
        default: defaultTable,
        examples: [defaultTable],
        description: currentValueDescription(
          `Table content. Use columns for headers and rows for body cells. You may change the number of columns and rows, up to ${TABLE_MAX_COLUMNS} columns and ${TABLE_MAX_ROWS} body rows`,
          summarizeTable(slot),
        ),
        type: "object",
        additionalProperties: false,
        properties: {
          columns: {
            title: "Column headers",
            type: "array",
            minItems: 1,
            maxItems: TABLE_MAX_COLUMNS,
            items: { type: "string" },
          },
          rows: {
            title: "Body rows",
            description:
              "Each row should have the same number of cells as the columns array.",
            type: "array",
            minItems: 0,
            maxItems: TABLE_MAX_ROWS,
            items: {
              type: "array",
              minItems: 1,
              maxItems: TABLE_MAX_COLUMNS,
              items: { type: "string" },
            },
          },
        },
        required: ["columns", "rows"],
      };
    }
    case "chart": {
      const defaultChart = {
        chartType: slot.chartType,
        title: slot.title ?? "",
        data: slot.data,
      };
      const properties: Record<string, JsonSchema> = {
        chartType: {
          title: "Chart type",
          default: slot.chartType,
          examples: [slot.chartType],
          description: currentValueDescription(
            "Chart type. Choose the best chart type for the data",
            slot.chartType,
          ),
          type: "string",
          enum: ["bar", "line", "donut"],
        },
        title: {
          title: "Chart title",
          default: slot.title ?? "",
          examples: [slot.title ?? ""],
          description: currentValueDescription(
            "Chart title",
            slot.title ?? "",
          ),
          type: "string",
        },
        data: {
          title: "Chart data",
          default: slot.data,
          examples: [slot.data],
          description: currentValueDescription(
            `Chart data points. You may change the number of points, up to ${CHART_MAX_POINTS}`,
            slot.data.map((datum) => `${datum.label}: ${datum.value}`).join(" | "),
          ),
          type: "array",
          minItems: 1,
          maxItems: CHART_MAX_POINTS,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              label: { type: "string" },
              value: { type: "number" },
            },
            required: ["label", "value"],
          },
        },
      };

      return {
        title: `Chart ${index}`,
        default: defaultChart,
        examples: [defaultChart],
        description:
          "Dynamic chart content. Return the chart type, title, and data points that best fit the requested rewrite.",
        type: "object",
        additionalProperties: false,
        properties,
        required: ["chartType", "title", "data"],
      };
    }
    case "image":
      return {
        title: `Image ${index}`,
        description: currentValueDescription(
          "Image prompt or description. Do not return image bytes, base64, URLs, sizing, or placement",
          slot.name ?? "Image",
        ),
        type: "string",
      };
  }
}

function textSlot(
  element: Extract<SlideElement, { type: "text" }>,
): ContentSlot[] {
  const text = normalizeText(textContent(element));
  return text ? [{ kind: "text", text }] : [];
}

function listSlot(
  element: Extract<SlideElement, { type: "text-list" }>,
): ContentSlot[] {
  const items = textListStrings(element).map(normalizeText).filter(Boolean);
  return items.length > 0 ? [{ kind: "list", items }] : [];
}

function tableSlot(
  element: Extract<SlideElement, { type: "table" }>,
): ContentSlot[] {
  const [columns = [], ...rows] = tableRowsAsStrings(element).map((row) =>
    row.map(normalizeText),
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
    ? [{ kind: "table", columns: normalizedColumns, rows: normalizedRows }]
    : [];
}

function chartSlot(
  element: Extract<SlideElement, { type: "chart" }>,
): ContentSlot[] {
  const title = normalizeText(element.title);
  const data = element.data.map(({ label, value }) => ({
    label: normalizeText(label),
    value,
  }));

  return data.length > 0
    ? [
        {
          kind: "chart",
          chartType: element.chartType,
          ...(title ? { title } : {}),
          data,
        },
      ]
    : [];
}

function imageSlot(
  element: Extract<SlideElement, { type: "image" }>,
): ContentSlot[] {
  if (element.is_icon) return [];
  const box = elementBox(element);
  if (box.w < IMAGE_CONTENT_MIN_SIZE && box.h < IMAGE_CONTENT_MIN_SIZE) {
    return [];
  }

  const name = normalizeText(element.name);
  if (!name && !element.data) return [];
  return [{ kind: "image", ...(name ? { name } : {}) }];
}

function currentValueDescription(label: string, value: string): string {
  const currentValue = truncateForDescription(value);
  return currentValue ? `${label}. Current value: ${currentValue}` : label;
}

function summarizeTable(table: Extract<ContentSlot, { kind: "table" }>): string {
  const columns = table.columns.join(" | ");
  const rows = table.rows
    .slice(0, 4)
    .map((row) => row.join(" | "))
    .join(" / ");
  return [columns ? `columns: ${columns}` : "", rows ? `rows: ${rows}` : ""]
    .filter(Boolean)
    .join("; ");
}

function truncateForDescription(value: string): string {
  const normalized = normalizeText(value).replace(/\s+/g, " ");
  return normalized.length > DESCRIPTION_LIMIT
    ? `${normalized.slice(0, DESCRIPTION_LIMIT - 3)}...`
    : normalized;
}

function normalizeText(value: string | null | undefined): string {
  return value?.replace(/\r\n?/g, "\n").trim() ?? "";
}

function padRow(row: string[], length: number): string[] {
  return Array.from({ length }, (_value, index) => row[index] ?? "");
}

function clampCount(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function slidePropertyName(slideIndex: number): string {
  return `slide_${slideIndex + 1}`;
}
