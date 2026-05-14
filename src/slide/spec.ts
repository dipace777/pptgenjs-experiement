import { z } from "zod";

// Single source of truth for the deck. Both the React preview and the
// pptxgenjs generator consume this spec, so what you see ≈ what you export.
//
// Geometry is in inches (PowerPoint's native unit). Slides are widescreen
// 16:9 at 10 x 5.625 in.

export const SLIDE_W = 10;
export const SLIDE_H = 5.625;

export const HexColorSchema = z
  .string()
  .regex(/^#?[0-9A-Fa-f]{6}$/, "Use 6-digit hex colors, with or without #.");

export const LineSchema = z.object({
  color: HexColorSchema,
  width: z.number().min(0).max(8),
});

export const BoxSchema = z.object({
  x: z.number().min(0).max(SLIDE_W),
  y: z.number().min(0).max(SLIDE_H),
  w: z.number().positive().max(SLIDE_W),
  h: z.number().positive().max(SLIDE_H),
});

const baseElement = {
  ...BoxSchema.shape,
  opacity: z.number().min(0).max(1).nullish(),
};

export const TextElementSchema = z.object({
  ...baseElement,
  kind: z.literal("text"),
  text: z.string().min(1).max(700),
  fontFace: z.string().min(1).max(80).nullish(),
  fontSize: z.number().min(6).max(180),
  bold: z.boolean().nullish(),
  italic: z.boolean().nullish(),
  color: HexColorSchema,
  align: z.enum(["left", "center", "right"]).nullish(),
  valign: z.enum(["top", "middle", "bottom"]).nullish(),
  // Hundredths of a point (pptxgenjs/OOXML convention).
  charSpacing: z.number().min(-200).max(600).nullish(),
  // Multiplier, defaults to ~1.15 in the renderers.
  lineHeight: z.number().min(0.8).max(2.2).nullish(),
});

export const RectElementSchema = z.object({
  ...baseElement,
  kind: z.literal("rect"),
  fill: HexColorSchema,
  line: LineSchema.nullish(),
  // Corner radius in inches; 0 / undefined = square corners.
  rx: z.number().min(0).max(0.5).nullish(),
});

export const EllipseElementSchema = z.object({
  ...baseElement,
  kind: z.literal("ellipse"),
  fill: HexColorSchema,
  line: LineSchema.nullish(),
});

export const BulletsElementSchema = z.object({
  ...BoxSchema.shape,
  kind: z.literal("bullets"),
  items: z.array(z.string().min(1).max(180)).min(1).max(8),
  fontFace: z.string().min(1).max(80).nullish(),
  fontSize: z.number().min(8).max(36),
  color: HexColorSchema,
  bulletColor: HexColorSchema.nullish(),
  lineSpacingMultiple: z.number().min(0.9).max(2).nullish(),
});

export const SlideElementSchema = z.discriminatedUnion("kind", [
  TextElementSchema,
  RectElementSchema,
  EllipseElementSchema,
  BulletsElementSchema,
]);

export const SlideSchema = z.object({
  background: HexColorSchema,
  elements: z.array(SlideElementSchema).min(1).max(60),
  /** Optional short label shown in the thumbnail rail. */
  title: z.string().min(1).max(60).nullish(),
});

export const DeckSchema = z.object({
  title: z.string().min(1).max(90),
  slides: z.array(SlideSchema).min(1).max(12),
});

export type Inches = number;
export type Box = z.infer<typeof BoxSchema>;
export type TextElement = z.infer<typeof TextElementSchema>;
export type RectElement = z.infer<typeof RectElementSchema>;
export type EllipseElement = z.infer<typeof EllipseElementSchema>;
export type BulletsElement = z.infer<typeof BulletsElementSchema>;
export type SlideElement = z.infer<typeof SlideElementSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type Deck = z.infer<typeof DeckSchema>;

// ── Palette ─────────────────────────────────────────────────────────────
const NAVY = "0B1F3A";
const DEEP = "071425";
const BLUE = "75AADB"; // Argentina light blue
const BLUE_DK = "3E78B2";
const GOLD = "D4A24C";
const OFF_WHITE = "F4F6FA";
const PAPER = "FFFFFF";
const INK = "1A2B45";
const MUTED = "6A7894";
const MUTED_DK = "9AA7BD";

// Arial renders the same in Google Slides, PowerPoint Web, Keynote, and on
// Windows/macOS. Helvetica isn't bundled with Google's renderer and gets
// substituted with a wider face, which breaks our hand-tuned line wraps.
const SANS = "Arial";

// ── Shared chrome ───────────────────────────────────────────────────────
function footer(num: number, total: number, onDark: boolean): SlideElement[] {
  const c = onDark ? MUTED_DK : MUTED;
  return [
    {
      kind: "text",
      x: 0.5,
      y: 5.25,
      w: 4,
      h: 0.3,
      text: "LIONEL MESSI",
      fontSize: 9,
      color: c,
      charSpacing: 200,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 8.5,
      y: 5.25,
      w: 1.0,
      h: 0.3,
      text: `${String(num).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
      fontSize: 9,
      color: c,
      align: "right",
      fontFace: SANS,
    },
  ];
}

// ── Slide 1: Title ──────────────────────────────────────────────────────
const TOTAL = 6;

const slide1Title: Slide = {
  title: "Title",
  background: NAVY,
  elements: [
    // Massive watermark "10" on the right. Box stays inside the slide and
    // gives ample horizontal room so the digits never wrap or get clipped.
    {
      kind: "text",
      x: 3.8,
      y: 0.1,
      w: 6.2,
      h: 5.4,
      text: "10",
      fontSize: 300,
      bold: true,
      color: "FFFFFF",
      opacity: 0.05,
      fontFace: SANS,
      align: "center",
      valign: "middle",
    },
    // Top kicker
    { kind: "rect", x: 0.6, y: 0.55, w: 0.6, h: 0.06, fill: GOLD },
    {
      kind: "text",
      x: 0.6,
      y: 0.7,
      w: 6,
      h: 0.3,
      text: "PLAYER PROFILE · 2026",
      fontSize: 11,
      bold: true,
      color: BLUE,
      charSpacing: 300,
      fontFace: SANS,
    },
    // Big name
    {
      kind: "text",
      x: 0.6,
      y: 1.5,
      w: 8.5,
      h: 2.55,
      text: "LIONEL\nMESSI",
      fontSize: 78,
      bold: true,
      color: "FFFFFF",
      charSpacing: 50,
      lineHeight: 1.05,
      fontFace: SANS,
    },
    // Divider + tagline
    { kind: "rect", x: 0.6, y: 4.15, w: 0.5, h: 0.04, fill: GOLD },
    {
      kind: "text",
      x: 0.6,
      y: 4.3,
      w: 8,
      h: 0.45,
      text: "A footballing legend, told in six slides.",
      fontSize: 18,
      color: BLUE,
      fontFace: SANS,
    },
    ...footer(1, TOTAL, true),
  ],
};

// ── Slide 2: Profile ────────────────────────────────────────────────────
const slide2Profile: Slide = {
  title: "Profile",
  background: OFF_WHITE,
  elements: [
    // Left navy panel
    { kind: "rect", x: 0, y: 0, w: 3.7, h: SLIDE_H, fill: NAVY },
    // Accent bar across panel
    { kind: "rect", x: 0, y: 4.55, w: 3.7, h: 0.06, fill: GOLD },
    // Eyebrow
    {
      kind: "text",
      x: 0.5,
      y: 0.6,
      w: 3.0,
      h: 0.3,
      text: "PLAYER PROFILE",
      fontSize: 10,
      bold: true,
      color: GOLD,
      charSpacing: 300,
      fontFace: SANS,
    },
    // Name on panel
    {
      kind: "text",
      x: 0.5,
      y: 1.0,
      w: 3.0,
      h: 1.6,
      text: "Lionel\nMessi",
      fontSize: 40,
      bold: true,
      color: "FFFFFF",
      lineHeight: 1,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 0.5,
      y: 2.65,
      w: 3.0,
      h: 0.3,
      text: "Forward · Inter Miami CF",
      fontSize: 12,
      color: BLUE,
      fontFace: SANS,
    },
    // Meta block
    {
      kind: "text",
      x: 0.5,
      y: 3.15,
      w: 3.0,
      h: 1.3,
      text:
        "Born   24 June 1987\n" +
        "From   Rosario, Argentina\n" +
        "Foot   Left\n" +
        "Height 1.70 m",
      fontSize: 11,
      color: "D5DCE8",
      lineHeight: 1.6,
      fontFace: SANS,
    },

    // Right side — eyebrow
    {
      kind: "text",
      x: 4.2,
      y: 0.7,
      w: 5.4,
      h: 0.3,
      text: "OVERVIEW",
      fontSize: 10,
      bold: true,
      color: BLUE_DK,
      charSpacing: 300,
      fontFace: SANS,
    },
    // Headline
    {
      kind: "text",
      x: 4.2,
      y: 1.0,
      w: 5.4,
      h: 0.7,
      text: "The Greatest of All Time",
      fontSize: 26,
      bold: true,
      color: INK,
      fontFace: SANS,
    },
    // Lead paragraph
    {
      kind: "text",
      x: 4.2,
      y: 1.85,
      w: 5.4,
      h: 1.3,
      text:
        "An Argentine forward widely regarded as the greatest footballer of all time. " +
        "Record eight-time Ballon d'Or winner and 2022 FIFA World Cup champion " +
        "with Argentina, after two decades of dominance with FC Barcelona.",
      fontSize: 13,
      color: INK,
      lineHeight: 1.45,
      fontFace: SANS,
    },
    // Highlights header
    {
      kind: "text",
      x: 4.2,
      y: 3.35,
      w: 5.4,
      h: 0.3,
      text: "CAREER HIGHLIGHTS",
      fontSize: 10,
      bold: true,
      color: BLUE_DK,
      charSpacing: 300,
      fontFace: SANS,
    },
    { kind: "rect", x: 4.2, y: 3.7, w: 5.4, h: 0.02, fill: BLUE },
    {
      kind: "bullets",
      x: 4.2,
      y: 3.85,
      w: 5.4,
      h: 1.4,
      fontSize: 12,
      color: INK,
      bulletColor: GOLD,
      lineSpacingMultiple: 1.4,
      fontFace: SANS,
      items: [
        "8× Ballon d'Or winner (all-time record)",
        "FIFA World Cup champion — Qatar 2022",
        "4× UEFA Champions League winner",
        "All-time top scorer for Argentina and Barcelona",
      ],
    },
    ...footer(2, TOTAL, false),
  ],
};

// ── Slide 3: Career timeline ────────────────────────────────────────────
function timelineStop(
  cx: number,
  year: string,
  letter: string,
  club: string,
  period: string,
): SlideElement[] {
  return [
    // Year above
    {
      kind: "text",
      x: cx - 1.0,
      y: 2.0,
      w: 2.0,
      h: 0.35,
      text: year,
      fontSize: 12,
      bold: true,
      color: GOLD,
      charSpacing: 200,
      align: "center",
      fontFace: SANS,
    },
    // Circle
    { kind: "ellipse", x: cx - 0.45, y: 2.55, w: 0.9, h: 0.9, fill: BLUE_DK },
    {
      kind: "text",
      x: cx - 0.45,
      y: 2.55,
      w: 0.9,
      h: 0.9,
      text: letter,
      fontSize: 28,
      bold: true,
      color: "FFFFFF",
      align: "center",
      valign: "middle",
      fontFace: SANS,
    },
    // Club
    {
      kind: "text",
      x: cx - 1.4,
      y: 3.65,
      w: 2.8,
      h: 0.4,
      text: club,
      fontSize: 16,
      bold: true,
      color: "FFFFFF",
      align: "center",
      fontFace: SANS,
    },
    // Period
    {
      kind: "text",
      x: cx - 1.4,
      y: 4.05,
      w: 2.8,
      h: 0.3,
      text: period,
      fontSize: 11,
      color: MUTED_DK,
      align: "center",
      fontFace: SANS,
    },
  ];
}

const slide3Timeline: Slide = {
  title: "Career",
  background: DEEP,
  elements: [
    // Eyebrow
    {
      kind: "text",
      x: 0.6,
      y: 0.6,
      w: 6,
      h: 0.3,
      text: "CAREER JOURNEY",
      fontSize: 10,
      bold: true,
      color: GOLD,
      charSpacing: 300,
      fontFace: SANS,
    },
    // Title
    {
      kind: "text",
      x: 0.6,
      y: 0.95,
      w: 9,
      h: 0.7,
      text: "Three clubs. One left foot.",
      fontSize: 28,
      bold: true,
      color: "FFFFFF",
      fontFace: SANS,
    },

    // Connecting line
    { kind: "rect", x: 1.5, y: 2.99, w: 7.0, h: 0.025, fill: BLUE_DK },

    // Stops
    ...timelineStop(1.5, "2004", "B", "FC Barcelona", "2004 – 2021"),
    ...timelineStop(5.0, "2021", "P", "Paris SG", "2021 – 2023"),
    ...timelineStop(8.5, "2023", "M", "Inter Miami", "2023 – present"),

    ...footer(3, TOTAL, true),
  ],
};

// ── Slide 4: Stats grid ─────────────────────────────────────────────────
function statCard(
  x: number,
  y: number,
  w: number,
  h: number,
  big: string,
  label: string,
): SlideElement[] {
  return [
    // Card
    { kind: "rect", x, y, w, h, fill: PAPER, rx: 0.08 },
    // Left accent stripe
    { kind: "rect", x, y, w: 0.06, h, fill: GOLD },
    // Big number — sized to its own line-box so the frame doesn't extend
    // into the label area below.
    {
      kind: "text",
      x: x + 0.35,
      y: y + 0.22,
      w: w - 0.5,
      h: 0.75,
      text: big,
      fontSize: 48,
      bold: true,
      color: NAVY,
      lineHeight: 1.0,
      fontFace: SANS,
    },
    // Label — anchored to the card bottom with a clear gap above.
    {
      kind: "text",
      x: x + 0.35,
      y: y + h - 0.4,
      w: w - 0.5,
      h: 0.28,
      text: label,
      fontSize: 11,
      bold: true,
      color: MUTED,
      charSpacing: 300,
      fontFace: SANS,
    },
  ];
}

const slide4Stats: Slide = {
  title: "Stats",
  background: OFF_WHITE,
  elements: [
    {
      kind: "text",
      x: 0.6,
      y: 0.55,
      w: 6,
      h: 0.3,
      text: "BY THE NUMBERS",
      fontSize: 10,
      bold: true,
      color: BLUE_DK,
      charSpacing: 300,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 0.6,
      y: 0.9,
      w: 9,
      h: 0.7,
      text: "A career measured in records.",
      fontSize: 26,
      bold: true,
      color: INK,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 0.6,
      y: 1.55,
      w: 9,
      h: 0.3,
      text: "Career totals across club and country, through 2026.",
      fontSize: 12,
      color: MUTED,
      fontFace: SANS,
    },

    ...statCard(0.6, 2.1, 4.3, 1.4, "850+", "CAREER GOALS"),
    ...statCard(5.1, 2.1, 4.3, 1.4, "380+", "CAREER ASSISTS"),
    ...statCard(0.6, 3.6, 4.3, 1.4, "46", "MAJOR TROPHIES"),
    ...statCard(5.1, 3.6, 4.3, 1.4, "8", "BALLON D'OR AWARDS"),

    ...footer(4, TOTAL, false),
  ],
};

// ── Slide 5: World Cup 2022 ─────────────────────────────────────────────
function wcStat(x: number, big: string, label: string): SlideElement[] {
  return [
    {
      kind: "text",
      x,
      y: 4.0,
      w: 2.6,
      h: 0.7,
      text: big,
      fontSize: 44,
      bold: true,
      color: GOLD,
      align: "center",
      lineHeight: 1,
      fontFace: SANS,
    },
    {
      kind: "text",
      x,
      y: 4.75,
      w: 2.6,
      h: 0.3,
      text: label,
      fontSize: 10,
      bold: true,
      color: BLUE,
      charSpacing: 300,
      align: "center",
      fontFace: SANS,
    },
  ];
}

const slide5WorldCup: Slide = {
  title: "Qatar 2022",
  background: NAVY,
  elements: [
    // Decorative big "22" watermark. Box is intentionally much wider/taller
    // than the text so engine-to-engine metric differences (Chrome vs Google
    // Slides) can't cause wrapping or clipping.
    {
      kind: "text",
      x: 3.5,
      y: 0.1,
      w: 6.5,
      h: 5.4,
      text: "22",
      fontSize: 240,
      bold: true,
      color: "FFFFFF",
      opacity: 0.05,
      fontFace: SANS,
      align: "center",
      valign: "middle",
    },

    { kind: "rect", x: 0.6, y: 0.55, w: 0.6, h: 0.06, fill: GOLD },
    {
      kind: "text",
      x: 0.6,
      y: 0.7,
      w: 6,
      h: 0.3,
      text: "QATAR 2022",
      fontSize: 11,
      bold: true,
      color: GOLD,
      charSpacing: 300,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 0.6,
      y: 1.25,
      w: 9,
      h: 1.6,
      text: "“Finally, we have it.”",
      fontSize: 44,
      bold: true,
      italic: true,
      color: "FFFFFF",
      lineHeight: 1.1,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 0.6,
      y: 3.1,
      w: 6.5,
      h: 0.8,
      text: "After a 36-year wait, Argentina lift the World Cup — Messi finally claims the only trophy missing from his cabinet.",
      fontSize: 13,
      color: "D5DCE8",
      lineHeight: 1.5,
      fontFace: SANS,
    },

    // Divider above stats
    { kind: "rect", x: 0.6, y: 3.9, w: 8.8, h: 0.01, fill: BLUE_DK, opacity: 0.5 },

    ...wcStat(0.6, "7", "GOALS"),
    ...wcStat(3.7, "3", "ASSISTS"),
    ...wcStat(6.8, "2", "GOLDEN BALL"),

    ...footer(5, TOTAL, true),
  ],
};

// ── Slide 6: Legacy / closing ───────────────────────────────────────────
const slide6Legacy: Slide = {
  title: "Legacy",
  background: OFF_WHITE,
  elements: [
    // Big decorative opening quote
    {
      kind: "text",
      x: 0.3,
      y: -0.4,
      w: 3.5,
      h: 4.2,
      text: "“",
      fontSize: 260,
      bold: true,
      color: GOLD,
      opacity: 0.18,
      lineHeight: 1,
      fontFace: SANS,
    },

    {
      kind: "text",
      x: 1.2,
      y: 0.7,
      w: 7,
      h: 0.3,
      text: "LEGACY",
      fontSize: 10,
      bold: true,
      color: BLUE_DK,
      charSpacing: 300,
      fontFace: SANS,
    },

    // Quote — no manual \n; let the engine wrap inside the box so wrapping
    // is identical between the CSS preview and the PPTX export.
    {
      kind: "text",
      x: 1.2,
      y: 1.3,
      w: 7.6,
      h: 2.8,
      text: "Messi is the greatest of all time. He has won everything, and he has won it for longer than anyone else.",
      fontSize: 24,
      italic: true,
      color: INK,
      lineHeight: 1.35,
      fontFace: SANS,
    },

    { kind: "rect", x: 1.2, y: 4.2, w: 0.4, h: 0.04, fill: GOLD },
    {
      kind: "text",
      x: 1.2,
      y: 4.35,
      w: 7,
      h: 0.35,
      text: "Pep Guardiola",
      fontSize: 14,
      bold: true,
      color: INK,
      fontFace: SANS,
    },
    {
      kind: "text",
      x: 1.2,
      y: 4.7,
      w: 7,
      h: 0.3,
      text: "Former FC Barcelona manager",
      fontSize: 11,
      color: MUTED,
      fontFace: SANS,
    },

    ...footer(6, TOTAL, false),
  ],
};

export const messiDeck: Deck = {
  title: "Lionel Messi",
  slides: [
    slide1Title,
    slide2Profile,
    slide3Timeline,
    slide4Stats,
    slide5WorldCup,
    slide6Legacy,
  ],
};
