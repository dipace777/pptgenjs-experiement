import type { Slide } from "../../../../../lib/slide-schema";
import { DomElementLayer, elementBoxStyle } from "../shared";

export function SvgDomElement({
  scale,
  slide,
}: {
  scale: number;
  slide: Slide;
}) {
  return (
    <DomElementLayer>
      {slide.elements.map((element, index) =>
        element.kind === "svg" ? (
          <div
            key={index}
            style={{
              ...elementBoxStyle(element, scale),
              overflow: "hidden",
            }}
            dangerouslySetInnerHTML={{ __html: element.svg }}
          />
        ) : null,
      )}
    </DomElementLayer>
  );
}
