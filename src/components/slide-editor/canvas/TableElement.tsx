import { Group, Rect, Text } from "react-konva";
import type { TableElement as TableEl } from "../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../editorUtils";
import { geometry, type ElementCommonProps, type TableInteractionProps } from "./types";

export function TableElement({
  element,
  index,
  scale,
  selected,
  editing,
  onTableCellClick,
  setRef,
  events,
}: ElementCommonProps & TableInteractionProps & { element: TableEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  const rows = element.rows;
  const cols = Math.max(1, ...rows.map((row) => row.length));
  const rowH = height / rows.length;
  const colW = width / cols;
  const fontSize = element.fontSize * PT_TO_PX * (scale / PX_PER_IN);
  const fill = withHash(element.fill ?? "FFFFFF");
  const borderColor = withHash(element.borderColor);
  const headerFill = withHash(element.headerFill);

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
      <Rect
        width={width}
        height={height}
        fill={fill}
        stroke={selected ? stroke : borderColor}
        strokeWidth={selected ? strokeWidth : 1}
        cornerRadius={4}
      />
      {editing ? null : rows.map((row, rowIndex) =>
        Array.from({ length: cols }).map((_, colIndex) => {
          const isHeader = rowIndex === 0;
          return (
            <Group key={`${rowIndex}-${colIndex}`}>
              <Rect
                x={colIndex * colW}
                y={rowIndex * rowH}
                width={colW}
                height={rowH}
                fill={isHeader ? headerFill : fill}
                stroke={borderColor}
                strokeWidth={1}
                onClick={(event) => {
                  event.cancelBubble = true;
                  events.onClick(event);
                  onTableCellClick?.(rowIndex, colIndex);
                }}
                onTap={() => {
                  events.onTap();
                  onTableCellClick?.(rowIndex, colIndex);
                }}
              />
              <Text
                x={colIndex * colW + 8 * (scale / PX_PER_IN)}
                y={rowIndex * rowH + 6 * (scale / PX_PER_IN)}
                width={Math.max(1, colW - 16 * (scale / PX_PER_IN))}
                height={Math.max(1, rowH - 10 * (scale / PX_PER_IN))}
                text={row[colIndex] ?? ""}
                fill={withHash(isHeader ? element.headerTextColor : element.textColor)}
                fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
                fontSize={fontSize}
                fontStyle={isHeader ? "bold" : "normal"}
                align={colIndex === 0 ? "left" : "center"}
                verticalAlign="middle"
                listening={false}
              />
            </Group>
          );
        }),
      )}
    </Group>
  );
}
