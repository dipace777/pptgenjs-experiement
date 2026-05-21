import { Group, Rect, Text } from "react-konva";
import type { TextElement as TextEl } from "../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../editorUtils";
import { geometry, type ElementCommonProps } from "./types";

export function TextElement({
  element,
  index,
  scale,
  selected,
  editing,
  setRef,
  events,
}: ElementCommonProps & { element: TextEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  const fontSize = element.fontSize * PT_TO_PX * (scale / PX_PER_IN);
  const isTopAligned = (element.valign ?? "top") === "top";

  return (
    <Group
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      opacity={element.opacity ?? 1}
      {...events}
    >
      <Rect width={width} height={height} fill="rgba(0,0,0,0)" />
      {editing ? null : (
        <Text
          width={width}
          height={isTopAligned ? undefined : height}
          text={element.text}
          fill={withHash(element.color)}
          fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
          fontSize={fontSize}
          fontStyle={`${element.bold ? "bold" : "normal"} ${element.italic ? "italic" : ""}`}
          align={element.align ?? "left"}
          verticalAlign={element.valign ?? "top"}
          lineHeight={element.lineHeight ?? 1.15}
          letterSpacing={((element.charSpacing ?? 0) / 100) * PT_TO_PX * (scale / PX_PER_IN)}
          wrap="word"
          listening={false}
        />
      )}
      {selected ? (
        <Rect
          width={width}
          height={height}
          stroke={stroke}
          strokeWidth={strokeWidth}
          listening={false}
        />
      ) : null}
    </Group>
  );
}
