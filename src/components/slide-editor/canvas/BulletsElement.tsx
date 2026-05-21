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
  const linePx = bulletFontSize * lineHeight;
  const averageCharWidth = bulletFontSize * 0.52;
  const charsPerLine = Math.max(8, Math.floor(width / averageCharWidth));
  const items = element.items.map((item) => {
    const text = `• ${item}`;
    const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine));
    return {
      text,
      height: lineCount * linePx,
    };
  });

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
      {items.map((item, itemIndex) => {
        const yOffset = items
          .slice(0, itemIndex)
          .reduce((sum, previous) => sum + previous.height + itemGap, 0);
        return (
          <Text
            key={`${item.text}-${itemIndex}`}
            x={0}
            y={yOffset}
            width={width}
            text={item.text}
            fill={withHash(element.color)}
            fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
            fontSize={bulletFontSize}
            lineHeight={lineHeight}
            wrap="word"
            listening={false}
          />
        );
      })}
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
