import { z } from "zod";
import {
  setTableRowsFromStrings,
  setTextContent,
  setTextListStrings,
} from "./element-model";
import {
  CHART_MAX_POINTS,
  mapSlideContentElements,
  slidePropertyName,
  TABLE_MAX_COLUMNS,
  TABLE_MAX_ROWS,
  type SlideContentElement,
  type SlideContentSlot,
} from "./slide-content-slots";
import { ChartTypeSchema, type Deck, type Slide } from "./slide-schema";

const TEXT_MAX_LENGTH = 700;
const LIST_MAX_ITEMS = 8;
const LIST_ITEM_MAX_LENGTH = 180;
const TABLE_CELL_MAX_LENGTH = 80;
const CHART_LABEL_MAX_LENGTH = 40;
const CHART_TITLE_MAX_LENGTH = 80;
const IMAGE_NAME_MAX_LENGTH = 120;
const CHART_MIN_VALUE = -1_000_000;
const CHART_MAX_VALUE = 1_000_000;

export type SlideContentJson = Record<string, unknown>;
export type DeckContentJson =
  | Array<SlideContentJson | undefined>
  | Record<string, SlideContentJson | undefined>;

const TextSlotValueSchema = z.string();
const ListSlotValueSchema = z.array(z.string()).min(1).max(LIST_MAX_ITEMS);
const TableSlotValueSchema = z
  .object({
    columns: z.array(z.string()).min(1).max(TABLE_MAX_COLUMNS),
    rows: z
      .array(z.array(z.string()).min(1).max(TABLE_MAX_COLUMNS))
      .max(TABLE_MAX_ROWS),
  })
  .strict();
const ChartSlotValueSchema = z
  .object({
    chartType: ChartTypeSchema,
    title: z.string(),
    data: z
      .array(
        z
          .object({
            label: z.string(),
            value: z.number().min(CHART_MIN_VALUE).max(CHART_MAX_VALUE),
          })
          .strict(),
      )
      .min(1)
      .max(CHART_MAX_POINTS),
  })
  .strict();
const ImageSlotValueSchema = z.string();

export function applyDeckContentJson(
  deck: Deck,
  contentJson: DeckContentJson,
): Deck {
  return {
    ...deck,
    slides: deck.slides.map((slide, index) => {
      const slideContent = slideContentJsonAt(contentJson, index);
      return slideContent ? applySlideContentJson(slide, slideContent) : slide;
    }),
  };
}

export function applySlideContentJson(
  slide: Slide,
  contentJson: SlideContentJson,
): Slide {
  return {
    ...slide,
    elements: mapSlideContentElements(slide.elements, (element, slot) => {
      if (!hasOwn(contentJson, slot.key)) return element;
      return applySlotContent(element, slot, contentJson[slot.key]);
    }),
  };
}

function applySlotContent(
  element: SlideContentElement,
  slot: SlideContentSlot,
  value: unknown,
): SlideContentElement {
  switch (slot.kind) {
    case "text":
      if (element.type !== "text") return element;
      return setTextContent(
        element,
        boundedText(parseSlotValue(TextSlotValueSchema, slot.key, value), {
          fallback: " ",
          maxLength: TEXT_MAX_LENGTH,
        }),
      );
    case "list":
      if (element.type !== "text-list") return element;
      return setTextListStrings(
        element,
        parseSlotValue(ListSlotValueSchema, slot.key, value).map((item) =>
          boundedText(item, {
            fallback: " ",
            maxLength: LIST_ITEM_MAX_LENGTH,
          }),
        ),
      );
    case "table": {
      if (element.type !== "table") return element;
      const table = parseSlotValue(TableSlotValueSchema, slot.key, value);
      return setTableRowsFromStrings(
        element,
        normalizeTableRows(table.columns, table.rows),
      );
    }
    case "chart": {
      if (element.type !== "chart") return element;
      const chart = parseSlotValue(ChartSlotValueSchema, slot.key, value);
      const title = boundedText(chart.title, {
        fallback: "",
        maxLength: CHART_TITLE_MAX_LENGTH,
      });
      return {
        ...element,
        chartType: chart.chartType,
        title: title || undefined,
        data: chart.data.map((datum, index) => ({
          ...(element.data[index] ?? {}),
          label: boundedText(datum.label, {
            fallback: " ",
            maxLength: CHART_LABEL_MAX_LENGTH,
          }),
          value: datum.value,
        })),
      };
    }
    case "image":
      if (element.type !== "image") return element;
      return {
        ...element,
        name: boundedText(parseSlotValue(ImageSlotValueSchema, slot.key, value), {
          fallback: "",
          maxLength: IMAGE_NAME_MAX_LENGTH,
        }),
      };
  }
}

function normalizeTableRows(columns: string[], rows: string[][]): string[][] {
  const normalizedColumns = columns.map((value) =>
    boundedText(value, { fallback: "", maxLength: TABLE_CELL_MAX_LENGTH }),
  );
  const bodyRows =
    rows.length > 0
      ? rows
      : [Array.from({ length: normalizedColumns.length }, () => "")];

  return [
    normalizedColumns,
    ...bodyRows.map((row) =>
      Array.from({ length: normalizedColumns.length }, (_value, index) =>
        boundedText(row[index] ?? "", {
          fallback: "",
          maxLength: TABLE_CELL_MAX_LENGTH,
        }),
      ),
    ),
  ];
}

function slideContentJsonAt(
  contentJson: DeckContentJson,
  slideIndex: number,
): SlideContentJson | undefined {
  if (Array.isArray(contentJson)) {
    return contentJson[slideIndex];
  }

  const slideNumber = slideIndex + 1;
  return (
    contentJson[slidePropertyName(slideIndex)] ?? contentJson[String(slideNumber)]
  );
}

function parseSlotValue<T>(
  schema: z.ZodType<T>,
  key: string,
  value: unknown,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const reason = result.error.issues
    .map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid content for ${key}: ${reason}`);
}

function boundedText(
  value: string,
  {
    fallback,
    maxLength,
  }: {
    fallback: string;
    maxLength: number;
  },
) {
  const trimmed = value.trim();
  const normalized = trimmed || fallback;
  return normalized.length > maxLength
    ? normalized.slice(0, maxLength)
    : normalized;
}

function hasOwn(object: SlideContentJson, key: string) {
  return Object.prototype.hasOwnProperty.call(object, key);
}
