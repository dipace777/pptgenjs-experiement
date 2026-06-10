import { z } from "zod";
import {
  DeckSchema,
  SLIDE_H,
  type Deck,
  type Slide,
  type SlideElement,
  type ThemeRole,
} from "./slide-schema";

export const MIN_SLIDE_COUNT = 5;
export const MAX_SLIDE_COUNT = 20;

// Sections + title slide + agenda slide = total slides.
export const MIN_SECTION_COUNT = MIN_SLIDE_COUNT - 2;
export const MAX_SECTION_COUNT = MAX_SLIDE_COUNT - 2;

export const DeckGenerationInputSchema = z.object({
  title: z.string().min(1).max(90),
  description: z.string().min(1).max(1200),
  slideCount: z
    .number()
    .int()
    .min(MIN_SLIDE_COUNT)
    .max(MAX_SLIDE_COUNT)
    .default(6),
  theme: z.object({
    background: z.string().min(1),
    surface: z.string().min(1),
    primary: z.string().min(1),
    secondary: z.string().min(1),
    accent: z.string().min(1),
    text: z.string().min(1),
    muted: z.string().min(1),
  }),
});

export const SlideOutlineSchema = z.object({
  title: z.string().min(1).max(90),
  subtitle: z.string().min(1).max(140),
  sections: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        summary: z.string().min(1).max(180),
        bullets: z.array(z.string().min(1).max(110)).min(2).max(5),
        visual: z.enum(["bullets", "chart", "table"]),
      }),
    )
    .min(MIN_SECTION_COUNT)
    .max(MAX_SECTION_COUNT),
});

export type DeckGenerationInput = z.infer<typeof DeckGenerationInputSchema>;
export type SlideOutline = z.infer<typeof SlideOutlineSchema>;

const SANS = "Arial";

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cleanHex(value: string, fallback: string): string {
  const stripped = value.trim().replace(/^#/, "");
  return /^[0-9A-Fa-f]{6}$/.test(stripped) ? stripped.toUpperCase() : fallback;
}

function palette(input: DeckGenerationInput) {
  return {
    background: cleanHex(input.theme.background, "F7F8FB"),
    surface: cleanHex(input.theme.surface, "FFFFFF"),
    primary: cleanHex(input.theme.primary, "16324F"),
    secondary: cleanHex(input.theme.secondary, "3E78B2"),
    accent: cleanHex(input.theme.accent, "D4A24C"),
    text: cleanHex(input.theme.text, "172033"),
    muted: cleanHex(input.theme.muted, "68748A"),
    white: cleanHex(input.theme.surface, "FFFFFF"),
    line: "DDE4EF",
  };
}

function roleForColor(
  color: string | null | undefined,
  colors: ReturnType<typeof palette>,
): ThemeRole | undefined {
  if (!color) return undefined;
  const normalized = cleanHex(color, "");
  const roles: ThemeRole[] = [
    "background",
    "surface",
    "primary",
    "secondary",
    "accent",
    "text",
    "muted",
  ];
  return roles.find((role) => colors[role] === normalized);
}

function applyGeneratedThemeRoles(deck: Deck, colors: ReturnType<typeof palette>) {
  for (const slide of deck.slides) {
    slide.backgroundRole = roleForColor(slide.background, colors);
  }
}

export function fallbackOutline(input: DeckGenerationInput): SlideOutline {
  const subject = input.title.trim();
  const words = input.description
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 12);
  const angle = words.slice(0, 4).join(" ") || "strategy";

  const seedSections: SlideOutline["sections"] = [
    {
      title: "Context",
      summary: `Why ${subject} matters now and what the audience should understand first.`,
      bullets: [
        `Frame the current state of ${angle}`,
        "Name the audience, stakes, and decision window",
        "Separate durable facts from open questions",
      ],
      visual: "bullets",
    },
    {
      title: "Momentum",
      summary: "A compact readout of the signals that point to progress or pressure.",
      bullets: ["Adoption", "Efficiency", "Reach"],
      visual: "chart",
    },
    {
      title: "Operating Model",
      summary: "The core components that need to work together for the idea to land.",
      bullets: ["People", "Process", "Product", "Data", "Distribution", "Risk"],
      visual: "bullets",
    },
    {
      title: "Plan",
      summary: "A practical phased path from exploration to repeatable execution.",
      bullets: ["Discover", "Prototype", "Launch", "Scale"],
      visual: "table",
    },
    {
      title: "Risks",
      summary: "The failure modes worth naming up front so the plan stays honest.",
      bullets: ["Adoption gaps", "Capacity limits", "Data quality"],
      visual: "bullets",
    },
    {
      title: "Decisions",
      summary: "The open calls that need an owner and a date.",
      bullets: ["Budget approval", "Scope cut", "Hire trigger", "Vendor pick"],
      visual: "table",
    },
  ];

  const desiredSections = Math.max(
    MIN_SECTION_COUNT,
    Math.min(MAX_SECTION_COUNT, input.slideCount - 2),
  );
  const sections: SlideOutline["sections"] = [];
  for (let i = 0; i < desiredSections; i += 1) {
    const base = seedSections[i % seedSections.length];
    sections.push(
      i < seedSections.length
        ? base
        : { ...base, title: `${base.title} ${Math.floor(i / seedSections.length) + 1}` },
    );
  }

  return {
    title: subject,
    subtitle: input.description.slice(0, 130),
    sections,
  };
}

function footer(index: number, total: number, color: string): SlideElement[] {
  return [
    { type: "text", position: { x: 0.55, y: 5.22 }, size: { width: 4, height: 0.25 }, font: { family: SANS, size: 8, color: color, letterSpacing: 180 }, runs: [{ text: "GENERATED DECK" }] },
    { type: "text", position: { x: 8.35, y: 5.22 }, size: { width: 1.1, height: 0.25 }, font: { family: SANS, size: 8, color: color }, alignment: { horizontal: "right" }, runs: [{ text: `${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}` }] },
  ];
}

function titleSlide(outline: SlideOutline, colors: ReturnType<typeof palette>, total: number): Slide {
  return {
    title: "Title",
    background: colors.primary,
    elements: [
      { type: "rectangle", position: { x: 0.65, y: 0.7 }, size: { width: 0.72, height: 0.06 }, fill: { color: colors.accent } },
      { type: "text", position: { x: 0.65, y: 1.35 }, size: { width: 8.1, height: 1.35 }, font: { family: SANS, size: 44, color: colors.white, bold: true, lineHeight: 0.95 }, runs: [{ text: outline.title }] },
      { type: "text", position: { x: 0.7, y: 3.05 }, size: { width: 6.8, height: 0.72 }, font: { family: SANS, size: 17, color: "DCE6F2", lineHeight: 1.2 }, runs: [{ text: outline.subtitle }] },
      { type: "ellipse", position: { x: 7.25, y: 0.75 }, size: { width: 2.4, height: 2.4 }, opacity: 0.18, fill: { color: colors.accent } },
      ...footer(1, total, "9FB0C8"),
    ],
  };
}

function agendaSlide(outline: SlideOutline, colors: ReturnType<typeof palette>, total: number): Slide {
  const sectionCount = outline.sections.length;
  const isDense = sectionCount > 14;
  const columns = sectionCount > 8 ? 3 : 2;
  const rows = Math.ceil(sectionCount / columns);
  const startX = 0.65;
  const startY = 1.25;
  const gridW = 8.75;
  const bottomY = SLIDE_H - 0.75;
  const colGap = 0.18;
  const rowGap = 0.1;
  const cardW = (gridW - colGap * (columns - 1)) / columns;
  const cardH = clampNumber(
    (bottomY - startY - rowGap * (rows - 1)) / rows,
    0.42,
    1.52,
  );

  return {
    title: "Outline",
    background: colors.background,
    elements: [
      { type: "text", position: { x: 0.65, y: 0.55 }, size: { width: 6.8, height: 0.48 }, font: { family: SANS, size: 26, color: colors.text, bold: true }, runs: [{ text: "Deck outline" }] },
      ...outline.sections.flatMap((section, sectionIndex) => {
        const col = sectionIndex % columns;
        const row = Math.floor(sectionIndex / columns);
        const x = startX + col * (cardW + colGap);
        const y = startY + row * (cardH + rowGap);
        const number = String(sectionIndex + 1).padStart(2, "0");
        const card = { type: "rectangle", position: { x: x, y: y }, size: { width: cardW, height: cardH }, fill: { color: colors.white }, stroke: { color: colors.line, width: 0.75 }, borderRadius: { tl: 0.08, tr: 0.08, bl: 0.08, br: 0.08 } } satisfies SlideElement;

        if (isDense) {
          return [
            card,
            { type: "text", position: { x: x + 0.16, y: y + 0.12 }, size: { width: cardW - 0.32, height: 0.18 }, font: { family: SANS, size: 7, color: colors.muted, bold: true, letterSpacing: 50 }, runs: [{ text: `${number}  ${section.title.toUpperCase()}` }] },
            { type: "text", position: { x: x + 0.16, y: y + 0.3 }, size: { width: cardW - 0.32, height: Math.max(0.14, cardH - 0.36) }, font: { family: SANS, size: 6, color: colors.text, lineHeight: 1.05 }, runs: [{ text: section.summary }] },
          ] satisfies SlideElement[];
        }

        const summaryY = y + Math.min(0.68, cardH * 0.62);
        return [
          card,
          { type: "text", position: { x: x + 0.2, y: y + 0.16 }, size: { width: 0.62, height: 0.32 }, font: { family: SANS, size: cardH < 0.9 ? 16 : 25, color: colors.primary, bold: true }, runs: [{ text: number }] },
          { type: "text", position: { x: x + 0.9, y: y + 0.22 }, size: { width: cardW - 1.18, height: 0.24 }, font: { family: SANS, size: cardH < 0.9 ? 7 : 9, color: colors.muted, bold: true, letterSpacing: cardH < 0.9 ? 70 : 120 }, runs: [{ text: section.title.toUpperCase() }] },
          { type: "text", position: { x: x + 0.9, y: summaryY }, size: { width: cardW - 1.18, height: Math.max(0.16, cardH - (summaryY - y) - 0.12) }, font: { family: SANS, size: cardH < 0.9 ? 7 : 9, color: colors.text, lineHeight: cardH < 0.9 ? 1.05 : 1.18 }, runs: [{ text: section.summary }] },
        ] satisfies SlideElement[];
      }),
      ...footer(2, total, colors.muted),
    ],
  };
}

function sectionSlide(
  section: SlideOutline["sections"][number],
  index: number,
  total: number,
  colors: ReturnType<typeof palette>,
): Slide {
  const titleWidth = 4.15;
  const leftColumnWidth = 4.1;
  const titleLineCount = Math.min(3, Math.max(1, Math.ceil(section.title.length / 24)));
  const titleHeight = titleLineCount * 0.38;
  const summaryY = 0.82 + titleHeight + 0.16;
  const bulletsY = Math.max(2.35, summaryY + 1);
  const visualY = Math.max(1.05, 0.82 + titleHeight + 0.18);
  const visualH = Math.max(2.2, 4.35 - visualY);
  const base: SlideElement[] = [
    { type: "rectangle", position: { x: 0.65, y: 0.62 }, size: { width: 0.55, height: 0.06 }, fill: { color: colors.accent } },
    { type: "text", position: { x: 0.65, y: 0.82 }, size: { width: titleWidth, height: titleHeight }, font: { family: SANS, size: 26, color: colors.text, bold: true, lineHeight: 1.05 }, runs: [{ text: section.title }] },
    { type: "text", position: { x: 0.68, y: summaryY }, size: { width: leftColumnWidth, height: 0.78 }, font: { family: SANS, size: 14, color: colors.muted, lineHeight: 1.25 }, runs: [{ text: section.summary }] },
  ];

  const visual: SlideElement =
    section.visual === "chart"
      ? ({ type: "chart", position: { x: 5.25, y: visualY }, size: { width: 3.9, height: visualH }, chartType: "bar", data: section.bullets.slice(0, 4).map((label, itemIndex) => ({
            label: label.slice(0, 14),
            value: 35 + itemIndex * 17,
            color: itemIndex % 2 === 0 ? colors.accent : colors.primary,
          })), title: "Signal strength", color: colors.accent, axisColor: "AEB8C7", labelColor: colors.muted, showValues: true } satisfies SlideElement)
      : section.visual === "table"
          ? ({ type: "table", position: { x: 5.05, y: visualY }, size: { width: 4.1, height: visualH }, font: { family: SANS, size: 10, color: colors.text }, columns: [{ text: "Phase", fill: { color: colors.primary }, font: { color: colors.white, bold: true }, stroke: { color: colors.line, width: 1 } }, { text: "Focus", fill: { color: colors.primary }, font: { color: colors.white, bold: true }, stroke: { color: colors.line, width: 1 } }, { text: "Output", fill: { color: colors.primary }, font: { color: colors.white, bold: true }, stroke: { color: colors.line, width: 1 } }], rows: [...(section.bullets.slice(0, 4).map((item, itemIndex) => [
                  `${itemIndex + 1}`,
                  item.slice(0, 18),
                  itemIndex === 0 ? "Learn" : itemIndex === 1 ? "Build" : "Ship",
                ])).map((row) => row.map((text) => ({ text: text, fill: { color: colors.white }, stroke: { color: colors.line, width: 1 } })))] } satisfies SlideElement)
          : ({ type: "text-list", position: { x: 5.05, y: visualY }, size: { width: 3.95, height: visualH }, font: { family: SANS, size: 17, color: colors.text, lineHeight: 1.35 }, marker: "bullet", items: (section.bullets).map((text) => ({ type: "text" as const, text })) } satisfies SlideElement);

  return {
    title: section.title,
    background: colors.background,
    elements: [
      ...base,
      ...(section.visual === "bullets"
        ? []
        : [
            ({ type: "text-list", position: { x: 0.8, y: bulletsY }, size: { width: 3.7, height: Math.max(1.2, 4.82 - bulletsY) }, font: { family: SANS, size: 14, color: colors.text, lineHeight: 1.25 }, marker: "bullet", items: (section.bullets.slice(0, 4)).map((text) => ({ type: "text" as const, text })) } satisfies SlideElement),
          ]),
      visual,
      ...footer(index, total, colors.muted),
    ],
  };
}

export function deckFromOutline(input: DeckGenerationInput, outline: SlideOutline): Deck {
  const colors = palette(input);
  const total = outline.sections.length + 2;
  const slides = [
    titleSlide(outline, colors, total),
    agendaSlide(outline, colors, total),
    ...outline.sections.map((section, index) =>
      sectionSlide(section, index + 3, total, colors),
    ),
  ];

  const deck = DeckSchema.parse({
    title: outline.title,
    description: input.description,
    theme: {
      background: colors.background,
      surface: colors.surface,
      primary: colors.primary,
      secondary: colors.secondary,
      accent: colors.accent,
      text: colors.text,
      muted: colors.muted,
    },
    slides,
  });
  applyGeneratedThemeRoles(deck, colors);
  return deck;
}

export function generateFallbackDeck(input: DeckGenerationInput): Deck {
  return deckFromOutline(input, fallbackOutline(input));
}
