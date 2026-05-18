import { defineCatalog, type Spec } from "@json-render/core";
import { renderToSvg } from "@json-render/image/render";
import { schema, standardComponentDefinitions } from "@json-render/image/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateDeckData } from "./generateDeck";
import {
  SLIDE_W,
  type Deck,
  type Slide,
  type SlideElement,
} from "./spec";

const SVG_W = 1600;
const SVG_H = 900;
const PX_PER_IN = SVG_W / SLIDE_W;
const FONT_CANDIDATES = {
  regular: [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ],
  bold: [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  ],
};

export const SVG_THEMES = {
  landing: {
    label: "Landing Page",
    swatches: ["#08111e", "#4aa3ff", "#e2b85c"],
    audience: "startup buyers, product leaders, and investors",
    tone: "confident, concise, landing-page polish",
    visualStyle:
      "premium SaaS landing page, bold type, editorial sections, bright accents, crisp cards",
  },
  minimal: {
    label: "Minimal",
    swatches: ["#f7f8fb", "#141821", "#6f7d95"],
    audience: "executives and strategic decision makers",
    tone: "calm, precise, restrained",
    visualStyle:
      "minimal Swiss editorial deck, generous whitespace, tight typography, thin rules, neutral palette",
  },
  investor: {
    label: "Investor",
    swatches: ["#071425", "#2dd4bf", "#f8fafc"],
    audience: "investors, founders, and board members",
    tone: "crisp, evidence-led, commercially sharp",
    visualStyle:
      "investor memo deck, dark executive palette, metric cards, proof points, structured comparison layouts",
  },
  editorial: {
    label: "Editorial",
    swatches: ["#172033", "#f4f0e8", "#c84c31"],
    audience: "brand, marketing, and creative leaders",
    tone: "polished, narrative, magazine-like",
    visualStyle:
      "modern magazine editorial deck, expressive scale shifts, section labels, strong contrast, refined accents",
  },
  playful: {
    label: "Playful",
    swatches: ["#102a43", "#ffd166", "#ef476f"],
    audience: "product teams, launch teams, and creative stakeholders",
    tone: "bright, energetic, optimistic",
    visualStyle:
      "playful product launch deck, colorful accents, rounded panels, upbeat hierarchy, friendly momentum",
  },
} as const;

export type SvgThemeId = keyof typeof SVG_THEMES;

export const imageCatalog = defineCatalog(schema, {
  components: standardComponentDefinitions,
});

export const svgSlidePrompt = imageCatalog.prompt({
  system:
    "You are generating presentation slides as @json-render/image specs for SVG output.",
  customRules: [
    "Create one 1600x900 Frame per slide.",
    "Use Box, Heading, Text, and Divider components for landing-page-style SVG slides.",
    "Keep all element children present in the flat element map.",
  ],
});

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type SerializableSpec = {
  root: string;
  elements: Record<
    string,
    {
      type: string;
      props: Record<string, JsonValue>;
      children: string[];
    }
  >;
};

const GenerateSvgDeckInputSchema = z.object({
  topic: z.string().min(2).max(3000),
  theme: z.enum(Object.keys(SVG_THEMES) as [SvgThemeId, ...SvgThemeId[]]),
  audience: z.string().min(2).max(160).optional(),
  tone: z.string().min(2).max(120).optional(),
  slideCount: z.number().int().min(3).max(8),
  visualStyle: z.string().min(2).max(600).optional(),
});

export type GenerateSvgDeckInput = z.infer<typeof GenerateSvgDeckInputSchema>;

export type SvgDeck = {
  title: string;
  deck: Deck;
  slides: Array<{
    title?: string;
    spec: SerializableSpec;
    svg: string;
  }>;
};

function normalizePromptText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function conciseTopic(prompt: string) {
  const normalized = normalizePromptText(prompt);
  const productMatch = normalized.match(
    /(?:called|named|for|about)\s+["']?([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,3})["']?/,
  );

  if (productMatch?.[1]) {
    return `${productMatch[1].trim()} launch deck`;
  }

  const firstSentence = normalized.split(/[.!?]/)[0] ?? normalized;
  const cleaned = firstSentence
    .replace(/^(create|make|generate|build)\s+(a|an|the)?\s*/i, "")
    .replace(/\b(deck|presentation|slides?)\b.*$/i, "$1")
    .trim();

  return titleCase((cleaned || normalized).slice(0, 72));
}

function withHash(color: string) {
  return color.startsWith("#") ? color : `#${color}`;
}

function hexToRgb(color: string) {
  const hex = color.replace("#", "");
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ] as const;
}

function blendHex(fg: string, bg: string, opacity?: number) {
  if (opacity == null || opacity >= 1) return withHash(fg);
  const alpha = Math.max(0, Math.min(1, opacity));
  const [fr, fg_, fb] = hexToRgb(fg);
  const [br, bg_, bb] = hexToRgb(bg);
  const mix = (front: number, back: number) =>
    Math.round(back + (front - back) * alpha)
      .toString(16)
      .padStart(2, "0");

  return `#${mix(fr, br)}${mix(fg_, bg_)}${mix(fb, bb)}`;
}

function px(value: number) {
  return Math.round(value * PX_PER_IN);
}

function elementKey(index: number, suffix = "") {
  return `el-${index}${suffix}`;
}

function fontPx(points: number) {
  return Math.round(points * (PX_PER_IN / 72));
}

async function readFirstFont(paths: string[]) {
  const { readFile } = await import("node:fs/promises");

  for (const path of paths) {
    try {
      return await readFile(path);
    } catch {
      // Try the next common system font path.
    }
  }

  throw new Error("No SVG render font found. Add Arial or DejaVu Sans to the system.");
}

async function loadSvgFonts() {
  const regular = await readFirstFont(FONT_CANDIDATES.regular);
  const bold = await readFirstFont(FONT_CANDIDATES.bold).catch(() => regular);

  return [
    { name: "sans-serif", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "sans-serif", data: bold, weight: 700 as const, style: "normal" as const },
  ];
}

function boxProps(el: { x: number; y: number; w: number; h: number }) {
  return {
    position: "absolute",
    left: px(el.x),
    top: px(el.y),
    width: px(el.w),
    height: px(el.h),
    padding: null,
    paddingTop: null,
    paddingBottom: null,
    paddingLeft: null,
    paddingRight: null,
    margin: null,
    backgroundColor: null,
    borderWidth: null,
    borderColor: null,
    borderRadius: null,
    flex: null,
    alignItems: "stretch",
    justifyContent: "flex-start",
    flexDirection: "column",
    right: null,
    bottom: null,
    overflow: "hidden",
  } as const;
}

function addTextElement(
  spec: SerializableSpec,
  el: Extract<SlideElement, { kind: "text" }>,
  index: number,
  background: string,
) {
  const key = elementKey(index);
  const textKey = elementKey(index, "-text");

  spec.elements[key] = {
    type: "Box",
    props: {
      ...boxProps(el),
      alignItems:
        el.align === "center" ? "center" : el.align === "right" ? "flex-end" : "flex-start",
      justifyContent:
        el.valign === "middle" ? "center" : el.valign === "bottom" ? "flex-end" : "flex-start",
    },
    children: [textKey],
  };

  spec.elements[textKey] = {
    type: "Text",
    props: {
      text: el.text,
      fontSize: fontPx(el.fontSize),
      color: blendHex(el.color, background, el.opacity ?? undefined),
      align: el.align ?? "left",
      fontWeight: el.bold ? "bold" : "normal",
      fontStyle: el.italic ? "italic" : "normal",
      lineHeight: el.lineHeight ?? 1.15,
      letterSpacing: el.charSpacing != null ? `${el.charSpacing / 100}px` : null,
      textDecoration: "none",
    },
    children: [],
  };
}

function addBulletsElement(
  spec: SerializableSpec,
  el: Extract<SlideElement, { kind: "bullets" }>,
  index: number,
) {
  const key = elementKey(index);
  const children = el.items.map((_, itemIndex) =>
    elementKey(index, `-bullet-${itemIndex}`),
  );

  spec.elements[key] = {
    type: "Box",
    props: {
      ...boxProps(el),
      alignItems: "stretch",
      justifyContent: "flex-start",
      flexDirection: "column",
    },
    children,
  };

  for (const [itemIndex, item] of el.items.entries()) {
    spec.elements[children[itemIndex]] = {
      type: "Text",
      props: {
        text: `• ${item}`,
        fontSize: fontPx(el.fontSize),
        color: withHash(el.color),
        align: "left",
        fontWeight: "normal",
        fontStyle: "normal",
        lineHeight: el.lineSpacingMultiple ?? 1.3,
        letterSpacing: null,
        textDecoration: "none",
      },
      children: [],
    };
  }
}

function addShapeElement(
  spec: SerializableSpec,
  el: Extract<SlideElement, { kind: "rect" | "ellipse" }>,
  index: number,
  background: string,
) {
  const radius =
    el.kind === "ellipse"
      ? Math.max(px(el.w), px(el.h))
      : "rx" in el && el.rx
        ? px(el.rx)
        : 0;

  spec.elements[elementKey(index)] = {
    type: "Box",
    props: {
      ...boxProps(el),
      backgroundColor: blendHex(el.fill, background, el.opacity ?? undefined),
      borderWidth: el.line?.width ?? null,
      borderColor: el.line ? withHash(el.line.color) : null,
      borderRadius: radius,
    },
    children: [],
  };
}

function slideToSpec(slide: Slide): SerializableSpec {
  const spec: SerializableSpec = {
    root: "frame",
    elements: {
      frame: {
        type: "Frame",
        props: {
          width: SVG_W,
          height: SVG_H,
          backgroundColor: withHash(slide.background),
          padding: null,
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "flex-start",
        },
        children: slide.elements.map((_, index) => elementKey(index)),
      },
    },
  };

  for (const [index, el] of slide.elements.entries()) {
    if (el.kind === "text") addTextElement(spec, el, index, slide.background);
    else if (el.kind === "bullets") addBulletsElement(spec, el, index);
    else addShapeElement(spec, el, index, slide.background);
  }

  return spec;
}

export const generateSvgDeck = createServerFn({ method: "POST" })
  .inputValidator((data: GenerateSvgDeckInput) =>
    GenerateSvgDeckInputSchema.parse(data),
  )
  .handler(async ({ data }): Promise<SvgDeck> => {
    const theme = SVG_THEMES[data.theme];
    const deck = await generateDeckData({
      topic: conciseTopic(data.topic),
      audience: data.audience ?? theme.audience,
      tone: data.tone ?? theme.tone,
      slideCount: data.slideCount,
      visualStyle: [theme.visualStyle, data.visualStyle]
        .filter(Boolean)
        .join(". "),
    });
    const fonts = await loadSvgFonts();
    const slides = await Promise.all(
      deck.slides.map(async (slide) => {
        const spec = slideToSpec(slide);
        const svg = await renderToSvg(spec as Spec, {
          fonts,
          width: SVG_W,
          height: SVG_H,
        });
        return {
          title: slide.title ?? undefined,
          spec,
          svg,
        };
      }),
    );

    return {
      title: deck.title,
      deck,
      slides,
    };
  });
