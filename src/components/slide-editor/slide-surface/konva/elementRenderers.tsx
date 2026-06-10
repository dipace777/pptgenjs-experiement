import type { ReactNode } from "react";
import type { SlideElement } from "../../../../lib/slide-schema";
import {
  ELEMENT_REGISTRY,
  getElementDefinition,
  type ElementKind,
  type KonvaRendererKey,
} from "../../registry";
import { BulletsElement } from "./BulletsElement";
import { ChartElement } from "./ChartElement";
import { EllipseElement } from "./EllipseElement";
import { ImageElement } from "./ImageElement";
import { LineElement } from "./LineElement";
import { RectElement } from "./RectElement";
import { SvgElement } from "./SvgElement";
import { TableElement } from "./TableElement";
import { TextElement } from "./TextElement";
import type { ElementCommonProps, TableInteractionProps } from "./types";

export type KonvaElementRenderProps = ElementCommonProps &
  TableInteractionProps & {
    element: SlideElement;
    bulletsRenderMode?: "canvas" | "proxy";
    chartRenderMode?: "canvas" | "proxy";
    tableRenderMode?: "canvas" | "proxy";
    textRenderMode?: "canvas" | "proxy";
  };

const KONVA_RENDERERS = {
  rectangle: ({ element, ...rest }) =>
    element.type === "rectangle" ? (
      <RectElement element={element} {...rest} />
    ) : null,
  ellipse: ({ element, ...rest }) =>
    element.type === "ellipse" ? (
      <EllipseElement element={element} {...rest} />
    ) : null,
  line: ({ element, ...rest }) =>
    element.type === "line" ? <LineElement element={element} {...rest} /> : null,
  chart: ({ chartRenderMode, element, ...rest }) =>
    element.type === "chart" ? (
      <ChartElement element={element} renderMode={chartRenderMode} {...rest} />
    ) : null,
  table: ({ element, onTableCellClick, tableRenderMode, ...rest }) =>
    element.type === "table" ? (
      <TableElement
        element={element}
        onTableCellClick={onTableCellClick}
        renderMode={tableRenderMode}
        {...rest}
      />
    ) : null,
  image: ({ element, ...rest }) =>
    element.type === "image" ? <ImageElement element={element} {...rest} /> : null,
  svg: ({ element, ...rest }) =>
    element.type === "svg" ? <SvgElement element={element} {...rest} /> : null,
  "text-list": ({ bulletsRenderMode, element, ...rest }) =>
    element.type === "text-list" ? (
      <BulletsElement
        element={element}
        renderMode={bulletsRenderMode}
        {...rest}
      />
    ) : null,
  text: ({ element, textRenderMode, ...rest }) =>
    element.type === "text" ? (
      <TextElement element={element} renderMode={textRenderMode} {...rest} />
    ) : null,
} satisfies Record<
  KonvaRendererKey,
  (props: KonvaElementRenderProps) => ReactNode
>;

export function renderKonvaElement(props: KonvaElementRenderProps) {
  if (!isElementKind(props.element.type)) return null;
  const renderer = getElementDefinition(props.element.type).renderers.konva;
  return KONVA_RENDERERS[renderer](props);
}

function isElementKind(type: string): type is ElementKind {
  return type in ELEMENT_REGISTRY;
}
