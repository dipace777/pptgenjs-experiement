import { Text } from "react-konva";
import type { TextElement as TextEl } from "../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../editorUtils";
import { geometry, type ElementCommonProps } from "./types";

export function TextElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: TextEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  const fontSize = element.fontSize * PT_TO_PX * (scale / PX_PER_IN);

  return (
    <Text
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      text={element.text}
      fill={withHash(element.color)}
      opacity={element.opacity ?? 1}
      fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
      fontSize={fontSize}
      fontStyle={`${element.bold ? "bold" : "normal"} ${element.italic ? "italic" : ""}`}
      align={element.align ?? "left"}
      verticalAlign={element.valign ?? "top"}
      lineHeight={element.lineHeight ?? 1.15}
      letterSpacing={((element.charSpacing ?? 0) / 100) * PT_TO_PX * (scale / PX_PER_IN)}
      wrap="word"
      stroke={stroke}
      strokeWidth={strokeWidth}
      {...events}
    />
  );
}
