import type { CSSProperties } from "react";
import type { Slide } from "../../../../../lib/slide-schema";
import {
  DomElementLayer,
  elementBoxStyle,
  fontStyle,
  wrappedTextStyle,
} from "../shared";

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
    <DomElementLayer>
      {slide.elements.map((element, elementIndex) => {
        if (element.kind !== "text" || editingTextIndex === elementIndex) {
          return null;
        }

        const valign = element.valign ?? "top";
        return (
          <div
            key={elementIndex}
            style={{
              ...elementBoxStyle(element, scale),
              ...fontStyle(element, scale),
              ...textBoxStyle,
              alignItems:
                valign === "middle"
                  ? "center"
                  : valign === "bottom"
                    ? "flex-end"
                    : "flex-start",
              textAlign: element.align ?? "left",
            }}
          >
            <div style={textContentStyle}>{element.text}</div>
          </div>
        );
      })}
    </DomElementLayer>
  );
}

const textBoxStyle: CSSProperties = {
  display: "flex",
  ...wrappedTextStyle,
  whiteSpace: "pre-wrap",
};

const textContentStyle: CSSProperties = {
  width: "100%",
};
