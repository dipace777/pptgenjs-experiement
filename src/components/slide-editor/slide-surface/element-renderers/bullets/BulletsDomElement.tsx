import type { CSSProperties } from "react";
import type { Slide } from "../../../../../lib/slide-schema";
import {
  DomElementLayer,
  elementBoxStyle,
  fontStyle,
  wrappedTextStyle,
} from "../shared";

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
    <DomElementLayer>
      {slide.elements.map((element, elementIndex) => {
        if (
          element.kind !== "bullets" ||
          editingBulletsIndex === elementIndex
        ) {
          return null;
        }

        return (
          <ul
            key={elementIndex}
            style={{
              ...elementBoxStyle(element, scale),
              ...fontStyle(
                {
                  ...element,
                  lineHeight: element.lineSpacingMultiple ?? 1.3,
                },
                scale,
              ),
              ...listStyle,
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
    </DomElementLayer>
  );
}

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "1.1em",
  ...wrappedTextStyle,
  whiteSpace: "normal",
};

const itemStyle: CSSProperties = {
  paddingLeft: "0.15em",
};
