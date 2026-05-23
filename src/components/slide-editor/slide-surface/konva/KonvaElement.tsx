import type { SlideElement } from "../../../../lib/slide-schema";
import { BulletsElement } from "./BulletsElement";
import { ChartElement } from "./ChartElement";
import { EllipseElement } from "./EllipseElement";
import { ImageElement } from "./ImageElement";
import { RectElement } from "./RectElement";
import { SvgElement } from "./SvgElement";
import { TableElement } from "./TableElement";
import { TextElement } from "./TextElement";
import type { ElementCommonProps, TableInteractionProps } from "./types";

export function KonvaElement({
  element,
  bulletsRenderMode,
  chartRenderMode,
  onTableCellClick,
  tableRenderMode,
  textRenderMode,
  ...rest
}: ElementCommonProps &
  TableInteractionProps & {
    element: SlideElement;
    bulletsRenderMode?: "canvas" | "proxy";
    chartRenderMode?: "canvas" | "proxy";
    tableRenderMode?: "canvas" | "proxy";
    textRenderMode?: "canvas" | "proxy";
  }) {
  switch (element.kind) {
    case "rect":
      return <RectElement element={element} {...rest} />;
    case "ellipse":
      return <EllipseElement element={element} {...rest} />;
    case "chart":
      return <ChartElement element={element} renderMode={chartRenderMode} {...rest} />;
    case "table":
      return (
        <TableElement
          element={element}
          onTableCellClick={onTableCellClick}
          renderMode={tableRenderMode}
          {...rest}
        />
      );
    case "image":
      return <ImageElement element={element} {...rest} />;
    case "svg":
      return <SvgElement element={element} {...rest} />;
    case "bullets":
      return (
        <BulletsElement
          element={element}
          renderMode={bulletsRenderMode}
          {...rest}
        />
      );
    case "text":
      return <TextElement element={element} renderMode={textRenderMode} {...rest} />;
  }
}
