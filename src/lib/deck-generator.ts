import { z } from "zod";
import { DeckSchema, type Deck, type Slide, type SlideElement } from "./slide-schema";

export const DeckGenerationInputSchema = z.object({
  title: z.string().min(1).max(90),
  description: z.string().min(1).max(1200),
  theme: z.object({
    background: z.string().min(1),
    primary: z.string().min(1),
    accent: z.string().min(1),
    text: z.string().min(1),
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
        visual: z.enum(["bullets", "chart", "grid", "table"]),
      }),
    )
    .min(3)
    .max(5),
});

export type DeckGenerationInput = z.infer<typeof DeckGenerationInputSchema>;
export type SlideOutline = z.infer<typeof SlideOutlineSchema>;

const SANS = "Arial";

function cleanHex(value: string, fallback: string): string {
  const stripped = value.trim().replace(/^#/, "");
  return /^[0-9A-Fa-f]{6}$/.test(stripped) ? stripped.toUpperCase() : fallback;
}

function palette(input: DeckGenerationInput) {
  return {
    background: cleanHex(input.theme.background, "F7F8FB"),
    primary: cleanHex(input.theme.primary, "16324F"),
    accent: cleanHex(input.theme.accent, "D4A24C"),
    text: cleanHex(input.theme.text, "172033"),
    muted: "68748A",
    white: "FFFFFF",
    line: "DDE4EF",
  };
}

export function fallbackOutline(input: DeckGenerationInput): SlideOutline {
  const subject = input.title.trim();
  const words = input.description
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 12);
  const angle = words.slice(0, 4).join(" ") || "strategy";

  return {
    title: subject,
    subtitle: input.description.slice(0, 130),
    sections: [
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
        visual: "grid",
      },
      {
        title: "Plan",
        summary: "A practical phased path from exploration to repeatable execution.",
        bullets: ["Discover", "Prototype", "Launch", "Scale"],
        visual: "table",
      },
    ],
  };
}

function footer(index: number, total: number, color: string): SlideElement[] {
  return [
    {
      kind: "text",
      x: 0.55,
      y: 5.22,
      w: 4,
      h: 0.25,
      text: "GENERATED DECK",
      fontFace: SANS,
      fontSize: 8,
      color,
      charSpacing: 180,
    },
    {
      kind: "text",
      x: 8.35,
      y: 5.22,
      w: 1.1,
      h: 0.25,
      text: `${String(index).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      fontFace: SANS,
      fontSize: 8,
      color,
      align: "right",
    },
  ];
}

function titleSlide(outline: SlideOutline, colors: ReturnType<typeof palette>, total: number): Slide {
  return {
    title: "Title",
    background: colors.primary,
    elements: [
      { kind: "rect", x: 0.65, y: 0.7, w: 0.72, h: 0.06, fill: colors.accent },
      {
        kind: "text",
        x: 0.65,
        y: 1.35,
        w: 8.1,
        h: 1.35,
        text: outline.title,
        fontFace: SANS,
        fontSize: 44,
        bold: true,
        color: colors.white,
        lineHeight: 0.95,
      },
      {
        kind: "text",
        x: 0.7,
        y: 3.05,
        w: 6.8,
        h: 0.72,
        text: outline.subtitle,
        fontFace: SANS,
        fontSize: 17,
        color: "DCE6F2",
        lineHeight: 1.2,
      },
      {
        kind: "ellipse",
        x: 7.25,
        y: 0.75,
        w: 2.4,
        h: 2.4,
        fill: colors.accent,
        opacity: 0.18,
      },
      ...footer(1, total, "9FB0C8"),
    ],
  };
}

function agendaSlide(outline: SlideOutline, colors: ReturnType<typeof palette>, total: number): Slide {
  return {
    title: "Outline",
    background: colors.background,
    elements: [
      {
        kind: "text",
        x: 0.65,
        y: 0.55,
        w: 6.8,
        h: 0.48,
        text: "Deck outline",
        fontFace: SANS,
        fontSize: 26,
        bold: true,
        color: colors.text,
      },
      {
        kind: "grid",
        x: 0.65,
        y: 1.35,
        w: 8.7,
        h: 3.25,
        columns: 2,
        items: outline.sections.map((section, index) => ({
          type: section.visual === "chart" ? ("chart" as const) : ("text" as const),
          chartType: section.visual === "chart" ? ("bar" as const) : undefined,
          title: String(index + 1).padStart(2, "0"),
          subtitle: section.title,
        })),
        fontFace: SANS,
        numberFontSize: 25,
        labelFontSize: 9,
        numberColor: colors.primary,
        labelColor: colors.muted,
        fill: colors.white,
        borderColor: colors.line,
        gap: 0.16,
        rx: 0.08,
      },
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
  const base: SlideElement[] = [
    { kind: "rect", x: 0.65, y: 0.62, w: 0.55, h: 0.06, fill: colors.accent },
    {
      kind: "text",
      x: 0.65,
      y: 0.82,
      w: 5.8,
      h: 0.45,
      text: section.title,
      fontFace: SANS,
      fontSize: 26,
      bold: true,
      color: colors.text,
    },
    {
      kind: "text",
      x: 0.68,
      y: 1.35,
      w: 4.1,
      h: 0.78,
      text: section.summary,
      fontFace: SANS,
      fontSize: 14,
      color: colors.muted,
      lineHeight: 1.25,
    },
  ];

  const visual: SlideElement =
    section.visual === "chart"
      ? {
          kind: "chart",
          x: 5.25,
          y: 1.05,
          w: 3.9,
          h: 2.8,
          chartType: "bar",
          title: "Signal strength",
          data: section.bullets.slice(0, 4).map((label, itemIndex) => ({
            label: label.slice(0, 14),
            value: 35 + itemIndex * 17,
            color: itemIndex % 2 === 0 ? colors.accent : colors.primary,
          })),
          color: colors.accent,
          axisColor: "AEB8C7",
          labelColor: colors.muted,
          showValues: true,
        }
      : section.visual === "grid"
        ? {
            kind: "grid",
            x: 5.05,
            y: 0.95,
            w: 4.1,
            h: 3.2,
            columns: 2,
            items: section.bullets.slice(0, 6).map((item, itemIndex) => ({
              type: itemIndex % 3 === 1 ? ("chart" as const) : ("text" as const),
              chartType: itemIndex % 3 === 1 ? ("donut" as const) : undefined,
              title: String(itemIndex + 1).padStart(2, "0"),
              subtitle: item,
            })),
            fontFace: SANS,
            numberFontSize: 22,
            labelFontSize: 8,
            numberColor: colors.primary,
            labelColor: colors.muted,
            fill: colors.white,
            borderColor: colors.line,
            gap: 0.13,
            rx: 0.08,
          }
        : section.visual === "table"
          ? {
              kind: "table",
              x: 4.9,
              y: 1.05,
              w: 4.3,
              h: 2.75,
              rows: [
                ["Phase", "Focus", "Output"],
                ...section.bullets.slice(0, 4).map((item, itemIndex) => [
                  `${itemIndex + 1}`,
                  item.slice(0, 18),
                  itemIndex === 0 ? "Learn" : itemIndex === 1 ? "Build" : "Ship",
                ]),
              ],
              fontFace: SANS,
              fontSize: 10,
              textColor: colors.text,
              headerFill: colors.primary,
              headerTextColor: colors.white,
              borderColor: colors.line,
              fill: colors.white,
            }
          : {
              kind: "bullets",
              x: 5.05,
              y: 1.1,
              w: 3.95,
              h: 2.65,
              items: section.bullets,
              fontFace: SANS,
              fontSize: 17,
              color: colors.text,
              bulletColor: colors.accent,
              lineSpacingMultiple: 1.35,
            };

  return {
    title: section.title,
    background: colors.background,
    elements: [
      ...base,
      {
        kind: "bullets",
        x: 0.8,
        y: 2.35,
        w: 3.7,
        h: 1.85,
        items: section.bullets.slice(0, 4),
        fontFace: SANS,
        fontSize: 14,
        color: colors.text,
        bulletColor: colors.accent,
        lineSpacingMultiple: 1.25,
      },
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

  return DeckSchema.parse({
    title: outline.title,
    slides,
  });
}

export function generateFallbackDeck(input: DeckGenerationInput): Deck {
  return deckFromOutline(input, fallbackOutline(input));
}
