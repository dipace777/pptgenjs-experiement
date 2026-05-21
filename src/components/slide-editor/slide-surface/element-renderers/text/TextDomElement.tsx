import type { CSSProperties } from "react";
import type { Slide } from "../../../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../../../editorUtils";

export function TextDomElement({
  editingTextIndex,
  scale,
  slide,
}: {
  editingTextIndex?: number | null;
  scale: number;
  slide: Slide;
}) {
  return (
    <div aria-hidden="true" style={layerStyle}>
      {slide.elements.map((element, elementIndex) => {
        if (element.kind !== "text" || editingTextIndex === elementIndex) {
          return null;
        }

        const valign = element.valign ?? "top";
        return (
          <div
            key={elementIndex}
            style={{
              ...textBoxStyle,
              alignItems:
                valign === "middle"
                  ? "center"
                  : valign === "bottom"
                    ? "flex-end"
                    : "flex-start",
              color: withHash(element.color),
              fontFamily: `${element.fontFace ?? "Arial"}, Helvetica, sans-serif`,
              fontSize: element.fontSize * PT_TO_PX * (scale / PX_PER_IN),
              fontStyle: element.italic ? "italic" : "normal",
              fontWeight: element.bold ? 700 : 400,
              height: element.h * scale,
              left: element.x * scale,
              letterSpacing:
                ((element.charSpacing ?? 0) / 100) *
                PT_TO_PX *
                (scale / PX_PER_IN),
              lineHeight: element.lineHeight ?? 1.15,
              opacity: element.opacity ?? 1,
              textAlign: element.align ?? "left",
              top: element.y * scale,
              width: element.w * scale,
            }}
          >
            <div style={textContentStyle}>{element.text}</div>
          </div>
        );
      })}
    </div>
  );
}

const layerStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 2,
  pointerEvents: "none",
};

const textBoxStyle: CSSProperties = {
  position: "absolute",
  boxSizing: "border-box",
  display: "flex",
  overflow: "hidden",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const textContentStyle: CSSProperties = {
  width: "100%",
};
