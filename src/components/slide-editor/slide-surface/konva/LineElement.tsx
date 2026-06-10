import { Line } from "react-konva";
import type { LineElement as LineEl } from "../../../../lib/slide-schema";
import {
  strokeColor,
  strokeWidth as elementStrokeWidth,
} from "../../../../lib/element-model";
import { colorWithOpacity } from "../../editorUtils";
import { rotationProps, shadowProps } from "./elementVisuals";
import { geometry, type ElementCommonProps } from "./types";

export function LineElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: LineEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(
    element,
    scale,
    selected,
  );
  const lineWidth = elementStrokeWidth(element.stroke) || strokeWidth || 1;

  return (
    <Line
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      points={[0, 0, width, height]}
      {...rotationProps(element)}
      stroke={colorWithOpacity(
        strokeColor(element.stroke, stroke ?? "0B1F3A"),
        element.stroke.opacity,
      )}
      strokeWidth={lineWidth}
      opacity={element.opacity ?? 1}
      {...shadowProps(element.shadow, scale)}
      {...events}
    />
  );
}
