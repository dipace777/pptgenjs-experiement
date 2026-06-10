import { Rect } from "react-konva";
import type { RectElement as RectEl } from "../../../../lib/slide-schema";
import {
  fillColor,
  strokeColor,
  strokeWidth as elementStrokeWidth,
} from "../../../../lib/element-model";
import { colorWithOpacity } from "../../editorUtils";
import { konvaCornerRadius, rotationProps, shadowProps } from "./elementVisuals";
import { geometry, type ElementCommonProps } from "./types";

export function RectElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: RectEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  return (
    <Rect
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      {...rotationProps(element)}
      fill={colorWithOpacity(fillColor(element.fill, "FFFFFF"), element.fill?.opacity)}
      opacity={element.opacity ?? 1}
      cornerRadius={konvaCornerRadius(element, scale)}
      stroke={
        element.stroke
          ? colorWithOpacity(strokeColor(element.stroke), element.stroke.opacity)
          : stroke
      }
      strokeWidth={element.stroke ? elementStrokeWidth(element.stroke) : strokeWidth}
      {...shadowProps(element.shadow, scale)}
      {...events}
    />
  );
}
