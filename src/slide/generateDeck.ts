import { chat } from "@tanstack/ai";
import { createOpenaiChat } from "@tanstack/ai-openai";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  DeckSchema,
  SLIDE_H,
  SLIDE_W,
  type Deck,
  type LineSchema,
  type SlideElement,
} from "./spec";

const GenerateDeckInputSchema = z.object({
  topic: z.string().min(2).max(180),
  audience: z.string().min(2).max(160),
  tone: z.string().min(2).max(120),
  slideCount: z.number().int().min(3).max(8),
  visualStyle: z.string().min(2).max(180),
});

export type GenerateDeckInput = z.infer<typeof GenerateDeckInputSchema>;

const SANS = "Arial";
const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
const nullableBoolean = { type: ["boolean", "null"] };

const DeckOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "slides"],
  properties: {
    title: { type: "string" },
    slides: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "background", "elements"],
        properties: {
          title: nullableString,
          background: { type: "string" },
          elements: {
            type: "array",
            minItems: 1,
            maxItems: 60,
            items: {
              type: "object",
              additionalProperties: false,
              required: [
                "kind",
                "x",
                "y",
                "w",
                "h",
                "opacity",
                "text",
                "fontFace",
                "fontSize",
                "bold",
                "italic",
                "color",
                "align",
                "valign",
                "charSpacing",
                "lineHeight",
                "fill",
                "line",
                "rx",
                "items",
                "bulletColor",
                "lineSpacingMultiple",
              ],
              properties: {
                kind: { type: "string", enum: ["text", "rect", "ellipse", "bullets"] },
                x: { type: "number" },
                y: { type: "number" },
                w: { type: "number" },
                h: { type: "number" },
                opacity: nullableNumber,
                text: nullableString,
                fontFace: nullableString,
                fontSize: nullableNumber,
                bold: nullableBoolean,
                italic: nullableBoolean,
                color: nullableString,
                align: { type: ["string", "null"], enum: ["left", "center", "right", null] },
                valign: { type: ["string", "null"], enum: ["top", "middle", "bottom", null] },
                charSpacing: nullableNumber,
                lineHeight: nullableNumber,
                fill: nullableString,
                line: {
                  type: ["object", "null"],
                  additionalProperties: false,
                  required: ["color", "width"],
                  properties: {
                    color: { type: "string" },
                    width: { type: "number" },
                  },
                },
                rx: nullableNumber,
                items: {
                  type: ["array", "null"],
                  items: { type: "string" },
                },
                bulletColor: nullableString,
                lineSpacingMultiple: nullableNumber,
              },
            },
          },
        },
      },
    },
  },
} as const;

const RawLineSchema = z
  .object({
    color: z.string(),
    width: z.number(),
  })
  .nullish();

const RawElementSchema = z.object({
  kind: z.enum(["text", "rect", "ellipse", "bullets"]),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  opacity: z.number().nullish(),
  text: z.string().nullish(),
  fontFace: z.string().nullish(),
  fontSize: z.number().nullish(),
  bold: z.boolean().nullish(),
  italic: z.boolean().nullish(),
  color: z.string().nullish(),
  align: z.enum(["left", "center", "right"]).nullish(),
  valign: z.enum(["top", "middle", "bottom"]).nullish(),
  charSpacing: z.number().nullish(),
  lineHeight: z.number().nullish(),
  fill: z.string().nullish(),
  line: RawLineSchema,
  rx: z.number().nullish(),
  items: z.array(z.string()).nullish(),
  bulletColor: z.string().nullish(),
  lineSpacingMultiple: z.number().nullish(),
});

const RawDeckSchema = z.object({
  title: z.string(),
  slides: z.array(
    z.object({
      title: z.string().nullable(),
      background: z.string(),
      elements: z.array(RawElementSchema),
    }),
  ),
});

type RawElement = z.infer<typeof RawElementSchema>;

async function getOpenAIApiKey(): Promise<string> {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;

  try {
    const { readFile } = await import("node:fs/promises");
    const envFile = await readFile(".env", "utf8");
    const match = envFile.match(/^OPENAI_API_KEY=(.*)$/m);
    const fileKey = match?.[1]?.trim().replace(/^["']|["']$/g, "");
    if (fileKey) return fileKey;
  } catch {
    // Local .env is a development convenience; deployed environments should
    // provide OPENAI_API_KEY directly.
  }

  throw new Error(
    "OPENAI_API_KEY is not set. Add it to your server environment or local .env file.",
  );
}

function normalizeColor(color: string): string {
  return color.replace("#", "").toUpperCase();
}

function optionalColor(color: string | null | undefined, fallback: string) {
  return normalizeColor(color || fallback);
}

function optionalLine(
  line: z.infer<typeof RawLineSchema>,
): z.infer<typeof LineSchema> | undefined {
  if (!line) return undefined;
  return {
    color: optionalColor(line.color, "1A2B45"),
    width: line.width,
  };
}

function elementFromRaw(el: RawElement): SlideElement {
  const base = {
    x: el.x,
    y: el.y,
    w: el.w,
    h: el.h,
    opacity: el.opacity ?? undefined,
  };

  if (el.kind === "text") {
    return {
      ...base,
      kind: "text",
      text: el.text || "Untitled",
      fontFace: el.fontFace || SANS,
      fontSize: el.fontSize ?? 24,
      bold: el.bold ?? undefined,
      italic: el.italic ?? undefined,
      color: optionalColor(el.color, "1A2B45"),
      align: el.align ?? undefined,
      valign: el.valign ?? undefined,
      charSpacing: el.charSpacing ?? undefined,
      lineHeight: el.lineHeight ?? undefined,
    };
  }

  if (el.kind === "bullets") {
    return {
      ...base,
      kind: "bullets",
      items: el.items?.filter(Boolean).length
        ? el.items.filter(Boolean)
        : [el.text || "Key point"],
      fontFace: el.fontFace || SANS,
      fontSize: el.fontSize ?? 14,
      color: optionalColor(el.color, "1A2B45"),
      bulletColor: el.bulletColor
        ? optionalColor(el.bulletColor, "D4A24C")
        : undefined,
      lineSpacingMultiple: el.lineSpacingMultiple ?? undefined,
    };
  }

  if (el.kind === "ellipse") {
    return {
      ...base,
      kind: "ellipse",
      fill: optionalColor(el.fill, "75AADB"),
      line: optionalLine(el.line),
    };
  }

  return {
    ...base,
    kind: "rect",
    fill: optionalColor(el.fill, "FFFFFF"),
    line: optionalLine(el.line),
    rx: el.rx ?? undefined,
  };
}

function deckFromRaw(raw: unknown): Deck {
  const deck = RawDeckSchema.parse(raw);
  return DeckSchema.parse(
    normalizeDeck({
      title: deck.title,
      slides: deck.slides.map((slide) => ({
        title: slide.title ?? undefined,
        background: slide.background,
        elements: slide.elements.map(elementFromRaw),
      })),
    }),
  );
}

function fitBox(el: SlideElement): SlideElement {
  const next = { ...el };
  next.x = Math.min(Math.max(0, next.x), SLIDE_W - 0.1);
  next.y = Math.min(Math.max(0, next.y), SLIDE_H - 0.1);
  next.w = Math.min(Math.max(0.1, next.w), SLIDE_W - next.x);
  next.h = Math.min(Math.max(0.1, next.h), SLIDE_H - next.y);
  return next;
}

function normalizeDeck(deck: Deck): Deck {
  return {
    title: deck.title,
    slides: deck.slides.map((slide) => ({
      ...slide,
      background: normalizeColor(slide.background),
      title: slide.title ?? undefined,
      elements: slide.elements.map((element) => {
        const fitted = fitBox(element);
        if (fitted.kind === "text") {
          return {
            ...fitted,
            color: normalizeColor(fitted.color),
            fontFace: fitted.fontFace ?? SANS,
          };
        }
        if (fitted.kind === "bullets") {
          return {
            ...fitted,
            color: normalizeColor(fitted.color),
            bulletColor: fitted.bulletColor
              ? normalizeColor(fitted.bulletColor)
              : fitted.bulletColor,
            fontFace: fitted.fontFace ?? SANS,
          };
        }
        return {
          ...fitted,
          fill: normalizeColor(fitted.fill),
          line: fitted.line
            ? { ...fitted.line, color: normalizeColor(fitted.line.color) }
            : fitted.line,
        };
      }),
    })),
  };
}

export const generateDeck = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateDeckInput) =>
    GenerateDeckInputSchema.parse(data),
  )
  .handler(async ({ data }) => {
    const prompt = [
      `Create a ${data.slideCount}-slide presentation deck about "${data.topic}".`,
      `Audience: ${data.audience}.`,
      `Tone: ${data.tone}.`,
      `Visual style: ${data.visualStyle}.`,
      "",
      "Return only a deck that matches the schema. Element properties that do not apply to a kind must be null.",
      `Canvas is ${SLIDE_W} x ${SLIDE_H} inches. Keep every element fully inside that canvas.`,
      "Use only text, bullets, rectangles, and ellipses. Do not invent image fields.",
      "For text elements, set text, fontSize, color, and fontFace. Set fill/items/line/rx to null unless needed.",
      "For bullets elements, set items, fontSize, color, bulletColor, and fontFace. Set text/fill/line/rx to null unless needed.",
      "For rect and ellipse elements, set fill. Set text/font fields/items to null.",
      "Use Arial for fontFace so export stays compatible with PowerPoint, Google Slides, and Keynote.",
      "Use concise copy: title slides can be bold, content slides should have short headlines and 3-5 useful bullets.",
      "Prefer high-contrast colors and leave clean margins of at least 0.35 inches.",
      "Hex colors must be six digits without alpha.",
    ].join("\n");

    const deck = await chat({
      adapter: createOpenaiChat("gpt-4o-mini", await getOpenAIApiKey()),
      outputSchema: DeckOutputSchema,
      systemPrompts: [
        "You are a senior presentation designer. Generate practical, software-compatible slide JSON, not markdown.",
      ],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    });

    return deckFromRaw(deck);
  });
