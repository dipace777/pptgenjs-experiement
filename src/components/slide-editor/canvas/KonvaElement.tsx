import type { SlideElement } from "../../../lib/slide-schema";
import { BulletsElement } from "./BulletsElement";
import { ChartElement } from "./ChartElement";
import { EllipseElement } from "./EllipseElement";
import { GridElement } from "./GridElement";
import { ImageElement } from "./ImageElement";
import { RectElement } from "./RectElement";
import { TableElement } from "./TableElement";
import { TextElement } from "./TextElement";
import type { ElementCommonProps } from "./types";

export function KonvaElement({
  element,
  ...rest
}: ElementCommonProps & { element: SlideElement }) {
  switch (element.kind) {
    case "rect":
      return <RectElement element={element} {...rest} />;
    case "ellipse":
      return <EllipseElement element={element} {...rest} />;
    case "chart":
      return <ChartElement element={element} {...rest} />;
    case "table":
      return <TableElement element={element} {...rest} />;
    case "grid":
      return <GridElement element={element} {...rest} />;
    case "image":
      return <ImageElement element={element} {...rest} />;
    case "bullets":
      return <BulletsElement element={element} {...rest} />;
    case "text":
      return <TextElement element={element} {...rest} />;
  }
}
