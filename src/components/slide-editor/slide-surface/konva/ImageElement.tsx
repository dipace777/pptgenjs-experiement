import { useEffect, useState } from "react";
import { Ellipse, Group, Image as KonvaImage, Line, Rect } from "react-konva";
import type { ImageElement as ImageEl } from "../../../../lib/slide-schema";
import { geometry, type ElementCommonProps } from "./types";

export function ImageElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: ImageEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);

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
      {element.data ? (
        <SlideImagePicture element={element} width={width} height={height} />
      ) : (
        <ImagePlaceholder width={width} height={height} />
      )}
      {selected ? (
        <Rect
          width={width}
          height={height}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={[6, 4]}
          listening={false}
        />
      ) : null}
    </Group>
  );
}

function SlideImagePicture({
  element,
  width,
  height,
}: {
  element: ImageEl;
  width: number;
  height: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!element.data) return;
    const next = new window.Image();
    next.onload = () => setImage(next);
    next.src = element.data;
  }, [element.data]);

  if (!image) return null;

  const fit = element.fit ?? "contain";
  const naturalRatio = image.width / image.height || 1;
  const boxRatio = width / height || 1;

  let drawW = width;
  let drawH = height;
  let offsetX = 0;
  let offsetY = 0;
  if (fit === "contain") {
    if (naturalRatio > boxRatio) {
      drawH = width / naturalRatio;
      offsetY = (height - drawH) / 2;
    } else {
      drawW = height * naturalRatio;
      offsetX = (width - drawW) / 2;
    }
  } else if (fit === "cover") {
    if (naturalRatio > boxRatio) {
      drawW = height * naturalRatio;
      offsetX = (width - drawW) / 2;
    } else {
      drawH = width / naturalRatio;
      offsetY = (height - drawH) / 2;
    }
  }

  return (
    <Group clipFunc={(ctx) => ctx.rect(0, 0, width, height)}>
      <KonvaImage
        image={image}
        x={offsetX}
        y={offsetY}
        width={drawW}
        height={drawH}
      />
    </Group>
  );
}

function ImagePlaceholder({ width, height }: { width: number; height: number }) {
  return (
    <Group>
      <Rect
        width={width}
        height={height}
        fill="#0a0d14"
        opacity={0.06}
        stroke="#7d89a3"
        strokeWidth={1}
        dash={[6, 4]}
      />
      <Rect
        x={width * 0.22}
        y={height * 0.3}
        width={width * 0.56}
        height={height * 0.32}
        stroke="#7d89a3"
        strokeWidth={1.2}
      />
      <Line
        points={[
          width * 0.26,
          height * 0.58,
          width * 0.4,
          height * 0.46,
          width * 0.54,
          height * 0.54,
          width * 0.74,
          height * 0.36,
        ]}
        stroke="#7d89a3"
        strokeWidth={1.2}
      />
      <Ellipse
        x={width * 0.66}
        y={height * 0.38}
        radiusX={Math.max(2, Math.min(width, height) * 0.02)}
        radiusY={Math.max(2, Math.min(width, height) * 0.02)}
        fill="#7d89a3"
      />
    </Group>
  );
}
