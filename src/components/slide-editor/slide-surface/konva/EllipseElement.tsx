import { Ellipse } from "react-konva";
import type { EllipseElement as EllipseEl } from "../../../../lib/slide-schema";
import {
  fillColor,
  strokeColor,
  strokeWidth as elementStrokeWidth,
} from "../../../../lib/element-model";
import { colorWithOpacity } from "../../editorUtils";
import { rotationProps, shadowProps } from "./elementVisuals";
import { geometry, type ElementCommonProps } from "./types";

export function EllipseElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: EllipseEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  return (
    <Ellipse
      ref={setRef}
      name={`element-${index}`}
      x={x + width / 2}
      y={y + height / 2}
      width={width}
      height={height}
      radiusX={width / 2}
      radiusY={height / 2}
      {...rotationProps(element)}
      fill={colorWithOpacity(fillColor(element.fill, "FFFFFF"), element.fill?.opacity)}
      opacity={element.opacity ?? 1}
      stroke={
        element.stroke
          ? colorWithOpacity(strokeColor(element.stroke), element.stroke.opacity)
          : stroke
      }
      strokeWidth={element.stroke ? elementStrokeWidth(element.stroke) : strokeWidth}
      {...shadowProps(element.shadow, scale)}
      offsetX={0}
      offsetY={0}
      {...events}
    />
  );
}
