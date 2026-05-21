import type { CSSProperties } from "react";
import type { Slide } from "../../../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../../../editorUtils";
import type { TableCellSelection } from "../../../state";

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
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      {slide.elements.map((element, elementIndex) => {
        if (element.kind !== "table" || editingTableIndex === elementIndex) {
          return null;
        }

        const rows = element.rows;
        const cols = Math.max(1, ...rows.map((row) => row.length));
        const borderColor = withHash(element.borderColor);
        const opacity = element.opacity ?? 1;

        return (
          <table
            key={elementIndex}
            style={{
              ...tableStyle,
              left: element.x * scale,
              top: element.y * scale,
              width: element.w * scale,
              height: element.h * scale,
              borderColor,
              fontFamily: `${element.fontFace ?? "Arial"}, Helvetica, sans-serif`,
              fontSize: element.fontSize * PT_TO_PX * (scale / PX_PER_IN),
              opacity,
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
                    return (
                      <td
                        key={colIndex}
                        style={{
                          ...cellStyle,
                          width: `${100 / cols}%`,
                          height: `${100 / rows.length}%`,
                          borderColor,
                          background: withHash(
                            isHeader
                              ? element.headerFill
                              : element.fill ?? "FFFFFF",
                          ),
                          color: withHash(
                            isHeader
                              ? element.headerTextColor
                              : element.textColor,
                          ),
                          fontWeight: isHeader ? 700 : 400,
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
    </div>
  );
}

const tableStyle: CSSProperties = {
  position: "absolute",
  tableLayout: "fixed",
  borderCollapse: "collapse",
  boxSizing: "border-box",
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
