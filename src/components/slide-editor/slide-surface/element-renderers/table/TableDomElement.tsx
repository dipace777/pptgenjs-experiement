import type { CSSProperties } from "react";
import type { Slide } from "../../../../../lib/slide-schema";
import {
  elementFont,
  strokeColor,
  tableRowsAsStrings,
} from "../../../../../lib/element-model";
import { PT_TO_PX, PX_PER_IN, withHash } from "../../../editorUtils";
import type { TableCellSelection } from "../../../state";
import { DomElementLayer, elementBoxStyle } from "../shared";

export function TableDomElement({
  editingTableIndex,
  scale,
  selectedCell,
  slide,
}: {
  editingTableIndex?: number | null;
  scale: number;
  selectedCell?: TableCellSelection | null;
  slide: Slide;
}) {
  return (
    <DomElementLayer>
      {slide.elements.map((element, elementIndex) => {
        if (element.type !== "table" || editingTableIndex === elementIndex) {
          return null;
        }

        const rows = tableRowsAsStrings(element);
        const font = elementFont(element);
        const cols = Math.max(1, ...rows.map((row) => row.length));
        const borderColor = withHash(
          element.columns[0]?.stroke?.color ??
            element.rows[0]?.[0]?.stroke?.color ??
            "D9E2EF",
        );

        return (
          <table
            key={elementIndex}
            style={{
              ...elementBoxStyle(element, scale),
              ...tableStyle,
              borderColor,
              fontFamily: `${font.family}, Helvetica, sans-serif`,
              fontSize: font.size * PT_TO_PX * (scale / PX_PER_IN),
            }}
          >
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {Array.from({ length: cols }).map((_, colIndex) => {
                    const isHeader = rowIndex === 0;
                    const isSelected =
                      selectedCell?.elementIndex === elementIndex &&
                      selectedCell.rowIndex === rowIndex &&
                      selectedCell.colIndex === colIndex;
                    const cell = isHeader
                      ? element.columns[colIndex]
                      : element.rows[rowIndex - 1]?.[colIndex];
                    const cellBorderColor = withHash(
                      strokeColor(cell?.stroke, "D9E2EF"),
                    );
                    return (
                      <td
                        key={colIndex}
                        style={{
                          ...cellStyle,
                          width: `${100 / cols}%`,
                          height: `${100 / rows.length}%`,
                          borderColor: cellBorderColor,
                          background: withHash(
                            cell?.fill?.color ??
                              (isHeader
                                ? element.columns[0]?.fill?.color ?? "0B1F3A"
                                : "FFFFFF"),
                          ),
                          color: withHash(
                            cell?.font?.color ??
                              (isHeader
                                ? element.columns[0]?.font?.color ?? "FFFFFF"
                                : font.color),
                          ),
                          fontFamily: `${cell?.font?.family ?? font.family}, Helvetica, sans-serif`,
                          fontSize:
                            (cell?.font?.size ?? font.size) *
                            PT_TO_PX *
                            (scale / PX_PER_IN),
                          fontWeight: (cell?.font?.bold ?? isHeader) ? 700 : 400,
                          textAlign: colIndex === 0 ? "left" : "center",
                          boxShadow: isSelected
                            ? "inset 0 0 0 2px #6f93ff"
                            : undefined,
                        }}
                      >
                        {row[colIndex] ?? ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        );
      })}
    </DomElementLayer>
  );
}

const tableStyle: CSSProperties = {
  tableLayout: "fixed",
  borderCollapse: "collapse",
  borderWidth: 1,
  borderStyle: "solid",
  overflow: "hidden",
};

const cellStyle: CSSProperties = {
  boxSizing: "border-box",
  borderWidth: 1,
  borderStyle: "solid",
  padding: "0.05in 0.08in",
  lineHeight: 1.15,
  verticalAlign: "middle",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "normal",
  wordBreak: "break-word",
};
