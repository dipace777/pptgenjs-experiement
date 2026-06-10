import { useMemo, type CSSProperties } from "react";
import type { Slide } from "../../../../../lib/slide-schema";
import { elementFont, textListStrings } from "../../../../../lib/element-model";
import { fitBulletsFontToBox } from "../../../../../lib/textMeasure";
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
  // Pre-compute the effective fontSize for every bullets element on this
  // slide. Same rationale as TextDomElement: the DOM overlay is what the
  // user sees in the editor, so without shrinking here the preview
  // overflows while presentation/export views auto-fit.
  const effectiveFontSizes = useMemo(() => {
    const sizes = new Map<number, number>();
    slide.elements.forEach((element, index) => {
      if (element.type !== "text-list") return;
      sizes.set(index, fitBulletsFontToBox(element));
    });
    return sizes;
  }, [slide]);

  return (
    <DomElementLayer>
      {slide.elements.map((element, elementIndex) => {
        if (
          element.type !== "text-list" ||
          editingBulletsIndex === elementIndex
        ) {
          return null;
        }
        const font = elementFont(element);
        const items = textListStrings(element);
        const effective =
          effectiveFontSizes.get(elementIndex) ?? font.size;

        return (
          <ol
            key={elementIndex}
            style={{
              ...elementBoxStyle(element, scale),
              ...fontStyle(
                { font: { ...(element.font ?? {}), lineHeight: font.lineHeight ?? 1.3 } },
                scale,
                effective,
              ),
              ...listStyle,
              listStyleType:
                element.marker === "none"
                  ? "none"
                  : element.marker === "number"
                    ? "decimal"
                    : "disc",
              paddingLeft: element.marker === "none" ? 0 : "1.1em",
            }}
          >
            {items.map((item, itemIndex) => (
              <li
                key={`${item}-${itemIndex}`}
                style={{
                  ...itemStyle,
                  marginBottom:
                    itemIndex === items.length - 1
                      ? 0
                      : 0.05 * scale,
                }}
              >
                {item}
              </li>
            ))}
          </ol>
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
