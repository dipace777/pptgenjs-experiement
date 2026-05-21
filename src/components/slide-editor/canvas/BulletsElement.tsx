import { Group, Rect, Text } from "react-konva";
import type { BulletsElement as BulletsEl } from "../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../editorUtils";
import { geometry, type ElementCommonProps } from "./types";

export function BulletsElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: BulletsEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  const bulletFontSize = element.fontSize * PT_TO_PX * (scale / PX_PER_IN);
  const lineHeight = element.lineSpacingMultiple ?? 1.3;
  const itemGap = (element.itemGap ?? 0.05) * scale;
  const itemHeight = bulletFontSize * lineHeight;

  return (
    <Group
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      {...events}
    >
      {element.items.map((item, itemIndex) => (
        <Text
          key={`${item}-${itemIndex}`}
          x={0}
          y={itemIndex * (itemHeight + itemGap)}
          width={width}
          height={itemHeight}
          text={`• ${item}`}
          fill={withHash(element.color)}
          fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
          fontSize={bulletFontSize}
          lineHeight={lineHeight}
          wrap="word"
        />
      ))}
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
