// Canonical slide schema facade.
// Keep imports stable while the implementation lives in slide-schemaV2.

export * from "./slide-schemaV2";

export {
  BorderRadiusSchema as CornerRadiusSchema,
  RectangleElementSchema as RectElementSchema,
  StrokeSchema as LineSchema,
} from "./slide-schemaV2";

export type {
  BorderRadius as CornerRadius,
  RectangleElement as RectElement,
  Stroke as Line,
} from "./slide-schemaV2";
