import { useEffect, useMemo, useState } from "react";
import { Group, Image as KonvaImage, Rect } from "react-konva";
import type { SvgElement as SvgEl } from "../../../../lib/slide-schema";
import { geometry, type ElementCommonProps } from "./types";

export function SvgElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: SvgEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  const src = useMemo(() => svgToDataUri(element.svg), [element.svg]);
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const next = new window.Image();
    next.onload = () => setImage(next);
    next.src = src;
    return () => {
      next.onload = null;
    };
  }, [src]);

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
      {image ? (
        <KonvaImage image={image} width={width} height={height} listening={false} />
      ) : (
        <Rect width={width} height={height} fill="rgba(0,0,0,0.001)" />
      )}
      <Rect
        width={width}
        height={height}
        fill="rgba(0,0,0,0.001)"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </Group>
  );
}

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
