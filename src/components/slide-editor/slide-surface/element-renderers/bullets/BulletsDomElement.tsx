import type { CSSProperties } from "react";
import type { Slide } from "../../../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../../../editorUtils";

export function BulletsDomElement({
  editingBulletsIndex,
  scale,
  slide,
}: {
  editingBulletsIndex?: number | null;
  scale: number;
  slide: Slide;
}) {
  return (
    <div aria-hidden="true" style={layerStyle}>
      {slide.elements.map((element, elementIndex) => {
        if (
          element.kind !== "bullets" ||
          editingBulletsIndex === elementIndex
        ) {
          return null;
        }

        const fontSize = element.fontSize * PT_TO_PX * (scale / PX_PER_IN);
        return (
          <ul
            key={elementIndex}
            style={{
              ...listStyle,
              color: withHash(element.color),
              fontFamily: `${element.fontFace ?? "Arial"}, Helvetica, sans-serif`,
              fontSize,
              height: element.h * scale,
              left: element.x * scale,
              lineHeight: element.lineSpacingMultiple ?? 1.3,
              top: element.y * scale,
              width: element.w * scale,
            }}
          >
            {element.items.map((item, itemIndex) => (
              <li
                key={`${item}-${itemIndex}`}
                style={{
                  ...itemStyle,
                  marginBottom:
                    itemIndex === element.items.length - 1
                      ? 0
                      : (element.itemGap ?? 0.05) * scale,
                }}
              >
                {item}
              </li>
            ))}
          </ul>
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

const listStyle: CSSProperties = {
  position: "absolute",
  boxSizing: "border-box",
  margin: 0,
  overflow: "hidden",
  paddingLeft: "1.1em",
  whiteSpace: "normal",
  wordBreak: "break-word",
};

const itemStyle: CSSProperties = {
  paddingLeft: "0.15em",
};
