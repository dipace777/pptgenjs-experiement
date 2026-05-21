import { useEffect, useState } from "react";
import { Arc, Ellipse, Group, Image as KonvaImage, Line, Rect, Text } from "react-konva";
import type { GridElement as GridEl, GridItem } from "../../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, withHash } from "../../editorUtils";
import { geometry, type ElementCommonProps } from "./types";

export function GridElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: ElementCommonProps & { element: GridEl }) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(element, scale, selected);
  const columns = Math.max(1, element.columns);
  const rows = Math.max(1, Math.ceil(element.items.length / columns));
  const gap = (element.gap ?? 0.12) * scale;
  const cellW = (width - gap * (columns - 1)) / columns;
  const cellH = (height - gap * (rows - 1)) / rows;
  const numberFontSize = element.numberFontSize * PT_TO_PX * (scale / PX_PER_IN);
  const labelFontSize = element.labelFontSize * PT_TO_PX * (scale / PX_PER_IN);

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
      {element.items.map((item, itemIndex) => {
        const col = itemIndex % columns;
        const row = Math.floor(itemIndex / columns);
        const cellX = col * (cellW + gap);
        const cellY = row * (cellH + gap);
        const isChart = item.type === "chart";
        const isImage = item.type === "image";
        const chartType = item.chartType ?? "bar";
        return (
          <Group key={`${item.title}-${itemIndex}`} x={cellX} y={cellY}>
            <Rect
              width={cellW}
              height={cellH}
              fill={withHash(element.fill)}
              stroke={withHash(element.borderColor)}
              strokeWidth={1}
              cornerRadius={(element.rx ?? 0.08) * scale}
            />
            {isChart ? (
              <GridChartIcon
                chartType={chartType}
                width={cellW}
                height={cellH}
                color={withHash(element.numberColor)}
                scale={scale}
              />
            ) : null}
            {isImage && item.imageData ? (
              <GridUploadedImage item={item} width={cellW} height={cellH} />
            ) : null}
            {isImage && !item.imageData ? (
              <>
                <Rect
                  x={cellW * 0.18}
                  y={cellH * 0.27}
                  width={cellW * 0.64}
                  height={cellH * 0.32}
                  stroke={withHash(element.numberColor)}
                  strokeWidth={1.2}
                />
                <Line
                  points={[
                    cellW * 0.22,
                    cellH * 0.54,
                    cellW * 0.38,
                    cellH * 0.42,
                    cellW * 0.52,
                    cellH * 0.51,
                    cellW * 0.76,
                    cellH * 0.34,
                  ]}
                  stroke={withHash(element.numberColor)}
                  strokeWidth={1.2}
                />
                <Ellipse
                  x={cellW * 0.68}
                  y={cellH * 0.35}
                  radiusX={3 * (scale / PX_PER_IN)}
                  radiusY={3 * (scale / PX_PER_IN)}
                  fill={withHash(element.numberColor)}
                />
              </>
            ) : null}
            <Text
              x={0}
              y={isChart || isImage ? cellH * 0.08 : cellH * 0.16}
              width={cellW}
              height={isChart || isImage ? cellH * 0.22 : cellH * 0.46}
              text={item.title}
              fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
              fontSize={isChart || isImage ? numberFontSize * 0.72 : numberFontSize}
              fontStyle="bold"
              fill={withHash(element.numberColor)}
              align="center"
              verticalAlign="middle"
            />
            <Text
              x={cellW * 0.1}
              y={(isChart || isImage ? 0.78 : 0.68) * cellH}
              width={cellW * 0.8}
              height={(isChart || isImage ? 0.14 : 0.18) * cellH}
              text={item.subtitle || item.type.toUpperCase()}
              fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
              fontSize={labelFontSize}
              fontStyle="bold"
              fill={withHash(element.labelColor)}
              align="center"
            />
          </Group>
        );
      })}
      {selected ? (
        <Rect
          width={width}
          height={height}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={[6, 4]}
        />
      ) : null}
    </Group>
  );
}

function GridChartIcon({
  chartType,
  width,
  height,
  color,
  scale,
}: {
  chartType: "bar" | "line" | "pie" | "donut";
  width: number;
  height: number;
  color: string;
  scale: number;
}) {
  if (chartType === "bar") {
    return (
      <Group>
        {[0.22, 0.42, 0.62].map((x, index) => {
          const barHeight = height * (0.13 + index * 0.06);
          return (
          <Rect
            key={x}
            x={width * x}
            y={height * 0.62 - barHeight}
            width={width * 0.12}
            height={barHeight}
            fill={color}
            opacity={0.9}
          />
          );
        })}
      </Group>
    );
  }

  if (chartType === "pie" || chartType === "donut") {
    const radius = Math.min(width, height) * 0.18;
    return (
      <Group>
        <Arc
          x={width * 0.5}
          y={height * 0.46}
          innerRadius={chartType === "donut" ? radius * 0.52 : 0}
          outerRadius={radius}
          angle={240}
          rotation={-90}
          fill={color}
        />
        <Arc
          x={width * 0.5}
          y={height * 0.46}
          innerRadius={chartType === "donut" ? radius * 0.52 : 0}
          outerRadius={radius}
          angle={120}
          rotation={150}
          fill={color}
          opacity={0.42}
        />
      </Group>
    );
  }

  return (
    <Line
      points={[
        width * 0.18,
        height * 0.62,
        width * 0.4,
        height * 0.46,
        width * 0.62,
        height * 0.54,
        width * 0.82,
        height * 0.32,
      ]}
      stroke={color}
      strokeWidth={2 * Math.max(0.7, scale / 96)}
      tension={0.25}
    />
  );
}

function GridUploadedImage({
  item,
  width,
  height,
}: {
  item: GridItem;
  width: number;
  height: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const nextImage = new window.Image();
    nextImage.onload = () => setImage(nextImage);
    nextImage.src = item.imageData ?? "";
  }, [item.imageData]);

  if (!image) return null;

  return (
    <KonvaImage
      x={width * 0.08}
      y={height * 0.18}
      width={width * 0.84}
      height={height * 0.42}
      image={image}
      cornerRadius={6}
    />
  );
}
