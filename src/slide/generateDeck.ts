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
  type Slide,
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
const GENERATION_TIMEOUT_MS = 45000;
const nullableString = { type: ["string", "null"] };
const nullableNumber = { type: ["number", "null"] };
const nullableBoolean = { type: ["boolean", "null"] };

function deckOutputSchema() {
  return {
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
                  kind: {
                    type: "string",
                    enum: ["text", "rect", "ellipse", "bullets"],
                  },
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
                  align: {
                    type: ["string", "null"],
                    enum: ["left", "center", "right", null],
                  },
                  valign: {
                    type: ["string", "null"],
                    enum: ["top", "middle", "bottom", null],
                  },
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
  };
}

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
      title: z.string().nullish(),
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

function clampNumber(value: number | null | undefined, fallback: number, min: number, max: number) {
  return Math.min(Math.max(value ?? fallback, min), max);
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
      fontSize: clampNumber(el.fontSize, 24, 6, 360),
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
      fontSize: clampNumber(el.fontSize, 14, 8, 36),
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
    rx: el.rx != null ? clampNumber(el.rx, 0, 0, 0.5) : undefined,
  };
}

function deckFromRaw(raw: unknown): Deck {
  const deck = RawDeckSchema.parse(raw);
  return DeckSchema.parse(
    normalizeDeck({
      title: deck.title,
      slides: deck.slides.map((slide, index) => ({
        title: slide.title?.trim() || `Slide ${index + 1}`,
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
        if (fitted.kind === "chart") {
          return {
            ...fitted,
            color: normalizeColor(fitted.color),
            axisColor: fitted.axisColor
              ? normalizeColor(fitted.axisColor)
              : fitted.axisColor,
            labelColor: fitted.labelColor
              ? normalizeColor(fitted.labelColor)
              : fitted.labelColor,
            data: fitted.data.map((datum) => ({
              ...datum,
              color: datum.color ? normalizeColor(datum.color) : datum.color,
            })),
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

function slideBlueprint(slideCount: number): string {
  const required = [
    "1. Cover: strong title, subtitle, large decorative numeral/shape, accent bar, footer.",
    "2. Overview: left feature panel plus right-side headline, short paragraph, and 3-5 bullets.",
    "3. Journey / structure: timeline, process, or map with 3-4 labeled stops.",
    "4. Metrics / comparison: grid of stat cards, scorecards, or ranked facts.",
    "5. Spotlight: one memorable moment, quote, case study, or before/after layout.",
    "6. Closing: legacy, implications, recommendations, or next steps with a distinctive final visual.",
    "7. Detail appendix: extra evidence, risks, or stakeholder-specific guidance.",
    "8. Action plan: concrete priorities, owners, milestones, or takeaways.",
  ];

  return required.slice(0, slideCount).join("\n");
}

async function requestDeck(data: GenerateDeckInput, retryNote?: string) {
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    abortController.abort();
  }, GENERATION_TIMEOUT_MS);

  const prompt = [
    `Create exactly ${data.slideCount} slides for a presentation deck about "${data.topic}".`,
    `Audience: ${data.audience}.`,
    `Tone: ${data.tone}.`,
    `Visual style: ${data.visualStyle}.`,
    "",
    "Make it feature-complete like a polished default template, not a two-slide outline.",
    "Use this slide architecture:",
    slideBlueprint(data.slideCount),
    "",
    "Design requirements:",
    "- Each slide must feel visually distinct while sharing one coherent palette.",
    "- Include repeated chrome such as small footer labels, slide numbers, or accent rules.",
    "- Use layered rectangles/ellipses, accent bars, cards, dividers, watermarks, and section labels.",
    "- Content slides should include useful domain-specific copy, not generic filler.",
    "- Prefer 10-24 elements per slide so the preview and exported PPTX look intentionally designed.",
    "- Use no images because the renderer only supports text, bullets, rectangles, and ellipses.",
    "",
    "Schema requirements:",
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
    retryNote ? `Previous attempt issue: ${retryNote}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    return await chat({
      adapter: createOpenaiChat("gpt-4o-mini", await getOpenAIApiKey(), {
        timeout: GENERATION_TIMEOUT_MS,
        maxRetries: 1,
      }),
      abortController,
      outputSchema: deckOutputSchema(),
      systemPrompts: [
        "You are a senior presentation designer. Generate practical, software-compatible slide JSON, not markdown.",
        "You must output the exact requested slide count and enough visual structure for a finished template.",
      ],
      messages: [{ role: "user", content: prompt }],
      temperature: 0.45,
      maxTokens: 7000,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function qualityIssue(deck: Deck, slideCount: number): string | null {
  if (deck.slides.length !== slideCount) {
    return `expected ${slideCount} slides, got ${deck.slides.length}`;
  }

  return null;
}

function topicTitle(topic: string): string {
  return topic
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .slice(0, 88);
}

function footerElements(
  label: string,
  slideNumber: number,
  total: number,
): SlideElement[] {
  return [
    {
      kind: "text",
      x: 0.55,
      y: 5.22,
      w: 5,
      h: 0.24,
      text: label.toUpperCase(),
      fontSize: 8,
      bold: true,
      color: "8A95A8",
      charSpacing: 180,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 8.55,
      y: 5.22,
      w: 0.9,
      h: 0.24,
      text: `${String(slideNumber).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      fontSize: 8,
      color: "8A95A8",
      align: "right",
      fontFace: SANS,
    },
  ];
}

function fallbackSlide(
  data: GenerateDeckInput,
  slideNumber: number,
  total: number,
): Slide {
  const title = topicTitle(data.topic);
  const palette = {
    dark: "0B1F3A",
    deep: "071425",
    blue: "5BA8D9",
    gold: "D4A24C",
    paper: "F6F8FC",
    ink: "1A2B45",
    muted: "64748B",
    white: "FFFFFF",
  };

  if (slideNumber === 1) {
    return {
      title: "Cover",
      background: palette.dark,
      elements: [
        {
          kind: "text",
          x: 5.1,
          y: 0.1,
          w: 4.5,
          h: 5.1,
          text: String(total),
          fontSize: 260,
          bold: true,
          color: palette.white,
          opacity: 0.05,
          align: "center",
          valign: "middle",
          fontFace: SANS,
        },
        { kind: "rect", x: 0.6, y: 0.58, w: 0.68, h: 0.06, fill: palette.gold },
        {
          kind: "text",
          x: 0.6,
          y: 0.75,
          w: 6.2,
          h: 0.28,
          text: "GENERATED TEMPLATE",
          fontSize: 10,
          bold: true,
          color: palette.blue,
          charSpacing: 260,
          fontFace: SANS,
        },
        {
          kind: "text",
          x: 0.6,
          y: 1.35,
          w: 8.1,
          h: 1.75,
          text: title,
          fontSize: 46,
          bold: true,
          color: palette.white,
          lineHeight: 1.05,
          fontFace: SANS,
        },
        {
          kind: "text",
          x: 0.6,
          y: 3.35,
          w: 7.0,
          h: 0.7,
          text: `A ${data.tone} deck for ${data.audience}.`,
          fontSize: 17,
          color: "D9E4F2",
          lineHeight: 1.3,
          fontFace: SANS,
        },
        { kind: "rect", x: 0.6, y: 4.35, w: 2.1, h: 0.04, fill: palette.gold },
        {
          kind: "ellipse",
          x: 8.25,
          y: 0.72,
          w: 0.9,
          h: 0.9,
          fill: palette.blue,
          opacity: 0.85,
        },
        {
          kind: "ellipse",
          x: 8.85,
          y: 1.32,
          w: 0.42,
          h: 0.42,
          fill: palette.gold,
        },
        ...footerElements(title, slideNumber, total),
      ],
    };
  }

  const slideTypes = [
    "Overview",
    "Journey",
    "Metrics",
    "Spotlight",
    "Close",
    "Evidence",
    "Action Plan",
  ];
  const label = slideTypes[slideNumber - 2] ?? `Section ${slideNumber}`;

  if (label === "Journey") {
    return {
      title: label,
      background: palette.deep,
      elements: [
        {
          kind: "text",
          x: 0.6,
          y: 0.58,
          w: 5.8,
          h: 0.28,
          text: "STRUCTURE",
          fontSize: 10,
          bold: true,
          color: palette.gold,
          charSpacing: 260,
          fontFace: SANS,
        },
        {
          kind: "text",
          x: 0.6,
          y: 0.95,
          w: 7.8,
          h: 0.58,
          text: "A clear path from context to impact.",
          fontSize: 26,
          bold: true,
          color: palette.white,
          fontFace: SANS,
        },
        { kind: "rect", x: 1.15, y: 2.9, w: 7.7, h: 0.03, fill: palette.blue },
        ...[1.35, 3.8, 6.25, 8.7].flatMap((x, i) => [
          {
            kind: "ellipse" as const,
            x: x - 0.38,
            y: 2.52,
            w: 0.76,
            h: 0.76,
            fill: i === 3 ? palette.gold : palette.blue,
          },
          {
            kind: "text" as const,
            x: x - 0.38,
            y: 2.52,
            w: 0.76,
            h: 0.76,
            text: String(i + 1),
            fontSize: 18,
            bold: true,
            color: palette.white,
            align: "center" as const,
            valign: "middle" as const,
            fontFace: SANS,
          },
          {
            kind: "text" as const,
            x: x - 0.88,
            y: 3.55,
            w: 1.76,
            h: 0.34,
            text: ["Context", "Signals", "Choices", "Result"][i],
            fontSize: 14,
            bold: true,
            color: palette.white,
            align: "center" as const,
            fontFace: SANS,
          },
          {
            kind: "text" as const,
            x: x - 1.02,
            y: 3.96,
            w: 2.04,
            h: 0.42,
            text: [
              "Frame the need",
              "Read the market",
              "Prioritize moves",
              "Measure progress",
            ][i],
            fontSize: 10,
            color: "AAB7CC",
            align: "center" as const,
            fontFace: SANS,
          },
        ]),
        ...footerElements(title, slideNumber, total),
      ],
    };
  }

  if (label === "Metrics") {
    return {
      title: label,
      background: palette.paper,
      elements: [
        {
          kind: "text",
          x: 0.6,
          y: 0.55,
          w: 5.5,
          h: 0.28,
          text: "BY THE NUMBERS",
          fontSize: 10,
          bold: true,
          color: "3E78B2",
          charSpacing: 260,
          fontFace: SANS,
        },
        {
          kind: "text",
          x: 0.6,
          y: 0.9,
          w: 8.4,
          h: 0.55,
          text: "A template with room for real proof.",
          fontSize: 25,
          bold: true,
          color: palette.ink,
          fontFace: SANS,
        },
        ...[
          ["01", "Primary opportunity"],
          ["03", "Audience segments"],
          ["05", "Priority moves"],
          ["90", "Day planning window"],
        ].flatMap(([big, text], i) => {
          const x = i % 2 === 0 ? 0.65 : 5.15;
          const y = i < 2 ? 2.0 : 3.55;
          return [
            {
              kind: "rect" as const,
              x,
              y,
              w: 4.15,
              h: 1.2,
              fill: palette.white,
              rx: 0.08,
            },
            {
              kind: "rect" as const,
              x,
              y,
              w: 0.07,
              h: 1.2,
              fill: palette.gold,
            },
            {
              kind: "text" as const,
              x: x + 0.35,
              y: y + 0.22,
              w: 1.3,
              h: 0.6,
              text: big,
              fontSize: 34,
              bold: true,
              color: palette.dark,
              fontFace: SANS,
            },
            {
              kind: "text" as const,
              x: x + 1.65,
              y: y + 0.36,
              w: 2.6,
              h: 0.34,
              text,
              fontSize: 13,
              bold: true,
              color: palette.ink,
              fontFace: SANS,
            },
          ];
        }),
        ...footerElements(title, slideNumber, total),
      ],
    };
  }

  const dark = slideNumber % 2 === 1;
  return {
    title: label,
    background: dark ? palette.dark : palette.paper,
    elements: [
      {
        kind: "rect",
        x: 0,
        y: 0,
        w: dark ? 3.55 : 3.15,
        h: SLIDE_H,
        fill: dark ? palette.deep : palette.dark,
      },
      {
        kind: "rect",
        x: 0,
        y: 4.55,
        w: dark ? 3.55 : 3.15,
        h: 0.06,
        fill: palette.gold,
      },
      {
        kind: "text",
        x: 0.5,
        y: 0.62,
        w: 2.5,
        h: 0.28,
        text: label.toUpperCase(),
        fontSize: 10,
        bold: true,
        color: palette.gold,
        charSpacing: 260,
        fontFace: SANS,
      },
      {
        kind: "text",
        x: 0.5,
        y: 1.05,
        w: 2.5,
        h: 1.05,
        text: title,
        fontSize: 25,
        bold: true,
        color: palette.white,
        lineHeight: 1.05,
        fontFace: SANS,
      },
      {
        kind: "text",
        x: 0.5,
        y: 2.45,
        w: 2.55,
        h: 0.72,
        text: data.visualStyle,
        fontSize: 11,
        color: "C8D5E8",
        lineHeight: 1.25,
        fontFace: SANS,
      },
      {
        kind: "text",
        x: 4.05,
        y: 0.7,
        w: 5.2,
        h: 0.3,
        text: `${label} slide`,
        fontSize: 10,
        bold: true,
        color: dark ? palette.blue : "3E78B2",
        charSpacing: 240,
        fontFace: SANS,
      },
      {
        kind: "text",
        x: 4.05,
        y: 1.08,
        w: 5.4,
        h: 0.7,
        text: [
          "What matters most right now",
          "The key story in one frame",
          "Where the deck should land",
        ][slideNumber % 3],
        fontSize: 24,
        bold: true,
        color: dark ? palette.white : palette.ink,
        fontFace: SANS,
      },
      {
        kind: "text",
        x: 4.05,
        y: 1.95,
        w: 5.25,
        h: 0.8,
        text: `Use this slide to turn ${data.topic} into specific evidence, choices, and takeaways for ${data.audience}.`,
        fontSize: 12,
        color: dark ? "D9E4F2" : palette.ink,
        lineHeight: 1.4,
        fontFace: SANS,
      },
      {
        kind: "bullets",
        x: 4.05,
        y: 3.02,
        w: 5.3,
        h: 1.45,
        items: [
          "Lead with the decision the audience needs to make",
          "Support it with concrete facts or examples",
          "Keep the layout editorial, structured, and easy to scan",
        ],
        fontSize: 12,
        color: dark ? palette.white : palette.ink,
        bulletColor: palette.gold,
        lineSpacingMultiple: 1.35,
        fontFace: SANS,
      },
      ...footerElements(title, slideNumber, total),
    ],
  };
}

function fallbackDeck(data: GenerateDeckInput): Deck {
  return DeckSchema.parse(
    normalizeDeck({
      title: topicTitle(data.topic),
      slides: Array.from({ length: data.slideCount }, (_, i) =>
        fallbackSlide(data, i + 1, data.slideCount),
      ),
    }),
  );
}

export async function generateDeckData(
  data: GenerateDeckInput,
  options: { fallback?: boolean } = {},
): Promise<Deck> {
  const shouldFallback = options.fallback ?? true;

  try {
    const generated = deckFromRaw(await requestDeck(data));
    const issue = qualityIssue(generated, data.slideCount);
    if (issue) {
      if (!shouldFallback) {
        throw new Error(`Generated deck failed quality check: ${issue}`);
      }
      return fallbackDeck(data);
    }
    return generated;
  } catch (err) {
    if (!shouldFallback) {
      throw err;
    }
    console.error("Falling back to local deck template", err);
    return fallbackDeck(data);
  }
}

export const generateDeck = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateDeckInput) =>
    GenerateDeckInputSchema.parse(data),
  )
  .handler(async ({ data }) => generateDeckData(data));
