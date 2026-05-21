import { z } from "zod";

// Single source of truth for the deck. Both the React preview and the
// pptxgenjs generator consume this schema, so what you see roughly matches
// what you export.
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
  fontSize: z.number().min(6).max(360),
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
  itemGap: z.number().min(0).max(0.4).nullish(),
});

export const ChartDatumSchema = z.object({
  label: z.string().min(1).max(40),
  value: z.number().min(0).max(1_000_000),
  color: HexColorSchema.nullish(),
});

export const ChartElementSchema = z.object({
  ...baseElement,
  kind: z.literal("chart"),
  chartType: z.enum(["bar", "line", "donut"]),
  title: z.string().min(1).max(80).nullish(),
  data: z.array(ChartDatumSchema).min(1).max(8),
  color: HexColorSchema,
  axisColor: HexColorSchema.nullish(),
  labelColor: HexColorSchema.nullish(),
  showValues: z.boolean().nullish(),
});

export const TableElementSchema = z.object({
  ...baseElement,
  kind: z.literal("table"),
  rows: z.array(z.array(z.string().max(80)).min(1).max(6)).min(2).max(8),
  fontFace: z.string().min(1).max(80).nullish(),
  fontSize: z.number().min(6).max(28),
  textColor: HexColorSchema,
  headerFill: HexColorSchema,
  headerTextColor: HexColorSchema,
  borderColor: HexColorSchema,
  fill: HexColorSchema.nullish(),
});

export const ImageElementSchema = z.object({
  ...baseElement,
  kind: z.literal("image"),
  data: z.string().nullish(),
  name: z.string().max(120).nullish(),
  fit: z.enum(["contain", "cover", "fill"]).nullish(),
});

export const GridItemSchema = z.object({
  type: z.enum(["text", "chart", "image"]),
  chartType: z.enum(["bar", "line", "pie", "donut"]).nullish(),
  imageData: z.string().nullish(),
  imageName: z.string().max(120).nullish(),
  title: z.string().min(1).max(80),
  subtitle: z.string().max(120).nullish(),
});

export const GridElementSchema = z.object({
  ...baseElement,
  kind: z.literal("grid"),
  items: z.array(GridItemSchema).min(1).max(12),
  columns: z.number().int().min(1).max(4),
  fontFace: z.string().min(1).max(80).nullish(),
  numberFontSize: z.number().min(8).max(72),
  labelFontSize: z.number().min(6).max(24),
  numberColor: HexColorSchema,
  labelColor: HexColorSchema,
  fill: HexColorSchema,
  borderColor: HexColorSchema,
  gap: z.number().min(0).max(0.4).nullish(),
  rx: z.number().min(0).max(0.5).nullish(),
});

export const SlideElementSchema = z.discriminatedUnion("kind", [
  TextElementSchema,
  RectElementSchema,
  EllipseElementSchema,
  BulletsElementSchema,
  ChartElementSchema,
  TableElementSchema,
  GridElementSchema,
  ImageElementSchema,
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
export type ChartDatum = z.infer<typeof ChartDatumSchema>;
export type ChartElement = z.infer<typeof ChartElementSchema>;
export type TableElement = z.infer<typeof TableElementSchema>;
export type GridItem = z.infer<typeof GridItemSchema>;
export type GridElement = z.infer<typeof GridElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type SlideElement = z.infer<typeof SlideElementSchema>;
export type Slide = z.infer<typeof SlideSchema>;
export type Deck = z.infer<typeof DeckSchema>;
