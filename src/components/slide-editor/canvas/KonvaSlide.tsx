import Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Arc,
  Ellipse,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import type { GridItem } from "../../../lib/slide-schema";
import { SLIDE_H, SLIDE_W, type Slide, type SlideElement } from "../../../lib/slide-schema";
import { PT_TO_PX, PX_PER_IN, clamp, withHash } from "../editorUtils";

export function KonvaSlide({
  slide,
  width,
  height,
  interactive,
  selected,
  selectedItems,
  onSelect,
  onChange,
  onChangeMany,
  stageRef,
}: {
  slide: Slide;
  width: number;
  height: number;
  interactive: boolean;
  selected?: number;
  selectedItems?: number[];
  onSelect?: (index: number, additive?: boolean) => void;
  onChange?: (index: number, element: SlideElement) => void;
  onChangeMany?: (updates: Array<{ index: number; element: SlideElement }>) => void;
  stageRef?: (stage: Konva.Stage | null) => void;
}) {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Array<Konva.Node | null>>([]);
  const groupDragRef = useRef<{
    index: number;
    nodePositions: Array<{ index: number; x: number; y: number }>;
    elements: Array<{ index: number; element: SlideElement }>;
  } | null>(null);
  const scale = width / SLIDE_W;
  const selectedIndexes = useMemo(
    () =>
      selectedItems && selectedItems.length > 0
        ? selectedItems
        : selected != null && selected >= 0
          ? [selected]
          : [],
    [selected, selectedItems],
  );

  useEffect(() => {
    if (!interactive) return;
    const transformer = transformerRef.current;
    if (!transformer) return;
    const nodes = selectedIndexes
      .map((index) => nodeRefs.current[index])
      .filter((node): node is Konva.Node => Boolean(node));
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [interactive, selectedIndexes, slide]);

  const commonEvents = (index: number, el: SlideElement) => ({
    draggable: interactive,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) =>
      onSelect?.(index, event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey),
    onTap: () => onSelect?.(index),
    onDragStart: () => {
      if (!selectedIndexes.includes(index) || selectedIndexes.length <= 1) {
        groupDragRef.current = null;
        return;
      }
      groupDragRef.current = {
        index,
        nodePositions: selectedIndexes.flatMap((selectedIndex) => {
          const node = nodeRefs.current[selectedIndex];
          return node ? [{ index: selectedIndex, x: node.x(), y: node.y() }] : [];
        }),
        elements: selectedIndexes.map((selectedIndex) => ({
          index: selectedIndex,
          element: slide.elements[selectedIndex],
        })),
      };
    },
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
      const groupDrag = groupDragRef.current;
      if (!groupDrag || groupDrag.index !== index) return;
      const origin = groupDrag.nodePositions.find((item) => item.index === index);
      if (!origin) return;
      const dx = event.target.x() - origin.x;
      const dy = event.target.y() - origin.y;
      groupDrag.nodePositions.forEach((item) => {
        if (item.index === index) return;
        const node = nodeRefs.current[item.index];
        node?.position({ x: item.x + dx, y: item.y + dy });
      });
      transformerRef.current?.getLayer()?.batchDraw();
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      const groupDrag = groupDragRef.current;
      if (groupDrag && groupDrag.index === index) {
        const origin = groupDrag.nodePositions.find((item) => item.index === index);
        if (!origin) return;
        const dx = (event.target.x() - origin.x) / scale;
        const dy = (event.target.y() - origin.y) / scale;
        onChangeMany?.(
          groupDrag.elements.map(({ index: selectedIndex, element }) => ({
            index: selectedIndex,
            element: {
              ...element,
              x: clamp(element.x + dx, 0, SLIDE_W - element.w),
              y: clamp(element.y + dy, 0, SLIDE_H - element.h),
            } as SlideElement,
          })),
        );
        groupDragRef.current = null;
        return;
      }
      const rawX = event.target.x() / scale;
      const rawY = event.target.y() / scale;
      const nextX = el.kind === "ellipse" ? rawX - el.w / 2 : rawX;
      const nextY = el.kind === "ellipse" ? rawY - el.h / 2 : rawY;
      onChange?.(index, {
        ...el,
        x: clamp(nextX, 0, SLIDE_W - el.w),
        y: clamp(nextY, 0, SLIDE_H - el.h),
      } as SlideElement);
    },
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => {
      const node = event.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const nextW = Math.max(0.1, (node.width() * scaleX) / scale);
      const nextH = Math.max(0.1, (node.height() * scaleY) / scale);
      const rawX = node.x() / scale;
      const rawY = node.y() / scale;
      const nextX = el.kind === "ellipse" ? rawX - nextW / 2 : rawX;
      const nextY = el.kind === "ellipse" ? rawY - nextH / 2 : rawY;
      node.scaleX(1);
      node.scaleY(1);
      onChange?.(index, {
        ...el,
        x: clamp(nextX, 0, SLIDE_W - nextW),
        y: clamp(nextY, 0, SLIDE_H - nextH),
        w: clamp(nextW, 0.1, SLIDE_W),
        h: clamp(nextH, 0.1, SLIDE_H),
      } as SlideElement);
    },
  });

  return (
    <Stage
      ref={stageRef}
      width={width}
      height={height}
      style={{
        display: "block",
        background: withHash(slide.background),
        borderRadius: interactive ? 6 : 2,
        overflow: "hidden",
        boxShadow: interactive ? "0 24px 70px rgba(0,0,0,0.42)" : "none",
      }}
      onMouseDown={(event) => {
        if (event.target === event.target.getStage()) onSelect?.(-1);
      }}
    >
      <Layer>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={withHash(slide.background)}
          listening={false}
        />
        {slide.elements.map((el, index) => (
          <KonvaElement
            key={index}
            element={el}
            index={index}
          scale={scale}
            selected={selectedIndexes.includes(index)}
            setRef={(node) => {
              nodeRefs.current[index] = node;
            }}
            events={commonEvents(index, el)}
          />
        ))}
        {interactive && selectedIndexes.length > 0 ? (
          <Transformer
            ref={transformerRef}
            rotateEnabled={false}
            anchorSize={8}
            borderStroke="#d4a24c"
            anchorFill="#f4f6fa"
            anchorStroke="#d4a24c"
            keepRatio={false}
          />
        ) : null}
      </Layer>
    </Stage>
  );
}

function KonvaElement({
  element,
  index,
  scale,
  selected,
  setRef,
  events,
}: {
  element: SlideElement;
  index: number;
  scale: number;
  selected: boolean;
  setRef: (node: Konva.Node | null) => void;
  events: {
    draggable: boolean;
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) => void;
    onTap: () => void;
    onDragStart: () => void;
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
    onTransformEnd: (event: Konva.KonvaEventObject<Event>) => void;
  };
}) {
  const x = element.x * scale;
  const y = element.y * scale;
  const width = element.w * scale;
  const height = element.h * scale;
  const stroke = selected ? "#d4a24c" : undefined;
  const strokeWidth = selected ? 1.5 : 0;

  if (element.kind === "rect") {
    return (
      <Rect
        ref={setRef}
        name={`element-${index}`}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={withHash(element.fill)}
        opacity={element.opacity ?? 1}
        cornerRadius={(element.rx ?? 0) * scale}
        stroke={element.line ? withHash(element.line.color) : stroke}
        strokeWidth={element.line ? element.line.width : strokeWidth}
        {...events}
      />
    );
  }

  if (element.kind === "ellipse") {
    return (
      <Ellipse
        ref={setRef}
        name={`element-${index}`}
        x={x + width / 2}
        y={y + height / 2}
        width={width}
        height={height}
        radiusX={width / 2}
        radiusY={height / 2}
        fill={withHash(element.fill)}
        opacity={element.opacity ?? 1}
        stroke={element.line ? withHash(element.line.color) : stroke}
        strokeWidth={element.line ? element.line.width : strokeWidth}
        offsetX={0}
        offsetY={0}
        {...events}
      />
    );
  }

  if (element.kind === "chart") {
    const max = Math.max(1, ...element.data.map((datum) => datum.value));
    const titleH = element.title ? 24 * (scale / PX_PER_IN) : 8;
    const pad = 12 * (scale / PX_PER_IN);
    const chartColor = withHash(element.color);
    const axisColor = withHash(element.axisColor ?? "9AA7BD");
    const labelColor = withHash(element.labelColor ?? "6A7894");
    const plot = {
      x: pad,
      y: titleH,
      w: Math.max(1, width - pad * 2),
      h: Math.max(1, height - titleH - pad),
    };

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
        <Rect
          width={width}
          height={height}
          fill="#ffffff"
          opacity={0.92}
          cornerRadius={6}
          stroke={stroke ?? axisColor}
          strokeWidth={selected ? strokeWidth : 0.5}
        />
        {element.title ? (
          <Text
            x={pad}
            y={8 * (scale / PX_PER_IN)}
            width={width - pad * 2}
            height={14 * (scale / PX_PER_IN)}
            text={element.title}
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={9 * (scale / PX_PER_IN)}
            fontStyle="bold"
            fill={labelColor}
          />
        ) : null}
        {element.chartType === "bar" ? (
          <BarChartParts
            data={element.data}
            max={max}
            plot={plot}
            color={chartColor}
            axisColor={axisColor}
            labelColor={labelColor}
            scale={scale}
            showValues={element.showValues ?? false}
          />
        ) : element.chartType === "line" ? (
          <LineChartParts
            data={element.data}
            max={max}
            plot={plot}
            color={chartColor}
            axisColor={axisColor}
            labelColor={labelColor}
            scale={scale}
            showValues={element.showValues ?? false}
          />
        ) : (
          <DonutChartParts
            data={element.data}
            plot={plot}
            color={chartColor}
            labelColor={labelColor}
            scale={scale}
            showValues={element.showValues ?? false}
          />
        )}
      </Group>
    );
  }

  if (element.kind === "table") {
    const rows = element.rows;
    const cols = Math.max(1, ...rows.map((row) => row.length));
    const rowH = height / rows.length;
    const colW = width / cols;
    const fontSize = element.fontSize * PT_TO_PX * (scale / PX_PER_IN);
    const fill = withHash(element.fill ?? "FFFFFF");
    const borderColor = withHash(element.borderColor);
    const headerFill = withHash(element.headerFill);

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
        <Rect
          width={width}
          height={height}
          fill={fill}
          stroke={selected ? stroke : borderColor}
          strokeWidth={selected ? strokeWidth : 1}
          cornerRadius={4}
        />
        {rows.map((row, rowIndex) =>
          Array.from({ length: cols }).map((_, colIndex) => {
            const isHeader = rowIndex === 0;
            return (
              <Group key={`${rowIndex}-${colIndex}`}>
                <Rect
                  x={colIndex * colW}
                  y={rowIndex * rowH}
                  width={colW}
                  height={rowH}
                  fill={isHeader ? headerFill : fill}
                  stroke={borderColor}
                  strokeWidth={1}
                />
                <Text
                  x={colIndex * colW + 8 * (scale / PX_PER_IN)}
                  y={rowIndex * rowH + 6 * (scale / PX_PER_IN)}
                  width={Math.max(1, colW - 16 * (scale / PX_PER_IN))}
                  height={Math.max(1, rowH - 10 * (scale / PX_PER_IN))}
                  text={row[colIndex] ?? ""}
                  fill={withHash(isHeader ? element.headerTextColor : element.textColor)}
                  fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
                  fontSize={fontSize}
                  fontStyle={isHeader ? "bold" : "normal"}
                  align={colIndex === 0 ? "left" : "center"}
                  verticalAlign="middle"
                />
              </Group>
            );
          }),
        )}
      </Group>
    );
  }

  if (element.kind === "grid") {
    const columns = Math.max(1, element.columns);
    const rows = Math.max(1, Math.ceil(element.items.length / columns));
    const gap = (element.gap ?? 0.12) * scale;
    const cellW = (width - gap * (columns - 1)) / columns;
    const cellH = (height - gap * (rows - 1)) / rows;
    const numberFontSize =
      element.numberFontSize * PT_TO_PX * (scale / PX_PER_IN);
    const labelFontSize =
      element.labelFontSize * PT_TO_PX * (scale / PX_PER_IN);

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
                <GridUploadedImage
                  item={item}
                  width={cellW}
                  height={cellH}
                />
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
                y={cellH * 0.68}
                width={cellW * 0.8}
                height={cellH * 0.18}
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

  if (element.kind === "bullets") {
    const bulletFontSize = element.fontSize * PT_TO_PX * (scale / PX_PER_IN);
    const lineHeight = element.lineSpacingMultiple ?? 1.3;
    const itemGap = (element.itemGap ?? 0.05) * scale;
    const itemHeight = bulletFontSize * lineHeight;

    return (
      <Group
        ref={setRef}
        name={`element-${index}`}
        x={x}
        y={y}
        width={width}
        height={height}
        {...events}
      >
        {element.items.map((item, itemIndex) => (
          <Text
            key={`${item}-${itemIndex}`}
            x={0}
            y={itemIndex * (itemHeight + itemGap)}
            width={width}
            height={itemHeight}
            text={`• ${item}`}
            fill={withHash(element.color)}
            fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
            fontSize={bulletFontSize}
            lineHeight={lineHeight}
            wrap="word"
          />
        ))}
        {selected ? (
          <Rect
            width={width}
            height={height}
            stroke={stroke}
            strokeWidth={strokeWidth}
            listening={false}
          />
        ) : null}
      </Group>
    );
  }

  const fontSize =
    element.fontSize * PT_TO_PX * (scale / PX_PER_IN);

  return (
    <Text
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      text={element.text}
      fill={withHash(element.color)}
      opacity={element.kind === "text" ? (element.opacity ?? 1) : 1}
      fontFamily={`${element.fontFace ?? "Arial"}, Helvetica, sans-serif`}
      fontSize={fontSize}
      fontStyle={
        element.kind === "text"
          ? `${element.bold ? "bold" : "normal"} ${
              element.italic ? "italic" : ""
            }`
          : "normal"
      }
      align={element.kind === "text" ? (element.align ?? "left") : "left"}
      verticalAlign={element.kind === "text" ? (element.valign ?? "top") : "top"}
      lineHeight={element.lineHeight ?? 1.15}
      letterSpacing={
        element.kind === "text"
          ? ((element.charSpacing ?? 0) / 100) *
            PT_TO_PX *
            (scale / PX_PER_IN)
          : 0
      }
      wrap="word"
      stroke={stroke}
      strokeWidth={strokeWidth}
      {...events}
    />
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
        {[0.22, 0.42, 0.62].map((x, index) => (
          <Rect
            key={x}
            x={width * x}
            y={height * (0.58 - index * 0.08)}
            width={width * 0.12}
            height={height * (0.18 + index * 0.08)}
            fill={color}
            opacity={0.9}
          />
        ))}
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

function BarChartParts({
  data,
  max,
  plot,
  color,
  axisColor,
  labelColor,
  scale,
  showValues,
}: {
  data: Array<{ label: string; value: number; color?: string | null }>;
  max: number;
  plot: { x: number; y: number; w: number; h: number };
  color: string;
  axisColor: string;
  labelColor: string;
  scale: number;
  showValues: boolean;
}) {
  const gap = 8 * (scale / PX_PER_IN);
  const barW = Math.max(4, (plot.w - gap * (data.length - 1)) / data.length);
  return (
    <>
      <Line points={[plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h]} stroke={axisColor} strokeWidth={1} />
      <Line points={[plot.x, plot.y, plot.x, plot.y + plot.h]} stroke={axisColor} strokeWidth={1} />
      {data.map((datum, index) => {
        const barH = (datum.value / max) * plot.h * 0.82;
        const x = plot.x + index * (barW + gap);
        const y = plot.y + plot.h - barH;
        return (
          <Group key={`${datum.label}-${index}`}>
            <Rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              fill={withHash(datum.color ?? color)}
              cornerRadius={2}
            />
            {showValues ? (
              <Text
                x={x}
                y={Math.max(plot.y, y - 12 * (scale / PX_PER_IN))}
                width={barW}
                height={10 * (scale / PX_PER_IN)}
                text={String(datum.value)}
                fontSize={7 * (scale / PX_PER_IN)}
                align="center"
                fill={labelColor}
              />
            ) : null}
          </Group>
        );
      })}
    </>
  );
}

function LineChartParts({
  data,
  max,
  plot,
  color,
  axisColor,
  labelColor,
  scale,
  showValues,
}: {
  data: Array<{ label: string; value: number; color?: string | null }>;
  max: number;
  plot: { x: number; y: number; w: number; h: number };
  color: string;
  axisColor: string;
  labelColor: string;
  scale: number;
  showValues: boolean;
}) {
  const labelBand = 16 * (scale / PX_PER_IN);
  const plotH = Math.max(1, plot.h - labelBand);
  const points = data.flatMap((datum, index) => [
    plot.x + (data.length === 1 ? 0 : (index / (data.length - 1)) * plot.w),
    plot.y + plotH - (datum.value / max) * plotH * 0.82,
  ]);
  return (
    <>
      <Line points={[plot.x, plot.y + plotH, plot.x + plot.w, plot.y + plotH]} stroke={axisColor} strokeWidth={1} />
      <Line points={[plot.x, plot.y, plot.x, plot.y + plotH]} stroke={axisColor} strokeWidth={1} />
      <Line points={points} stroke={color} strokeWidth={2} tension={0.28} />
      {data.map((datum, index) => {
        const cx =
          plot.x + (data.length === 1 ? 0 : (index / (data.length - 1)) * plot.w);
        const cy = plot.y + plotH - (datum.value / max) * plotH * 0.82;
        return (
          <Group key={`${datum.label}-${index}`}>
            <Ellipse
              x={cx}
              y={cy}
              radiusX={3.5 * (scale / PX_PER_IN)}
              radiusY={3.5 * (scale / PX_PER_IN)}
              fill={withHash(datum.color ?? color)}
              stroke="#ffffff"
              strokeWidth={1}
            />
            <Text
              x={cx - 14 * (scale / PX_PER_IN)}
              y={plot.y + plotH + 4 * (scale / PX_PER_IN)}
              width={28 * (scale / PX_PER_IN)}
              height={10 * (scale / PX_PER_IN)}
              text={datum.label}
              fontSize={7 * (scale / PX_PER_IN)}
              align="center"
              fill={labelColor}
            />
            {showValues ? (
              <Text
                x={cx - 14 * (scale / PX_PER_IN)}
                y={Math.max(plot.y, cy - 13 * (scale / PX_PER_IN))}
                width={28 * (scale / PX_PER_IN)}
                height={10 * (scale / PX_PER_IN)}
                text={String(datum.value)}
                fontSize={7 * (scale / PX_PER_IN)}
                align="center"
                fill={labelColor}
              />
            ) : null}
          </Group>
        );
      })}
    </>
  );
}

function DonutChartParts({
  data,
  plot,
  color,
  labelColor,
  scale,
  showValues,
}: {
  data: Array<{ label: string; value: number; color?: string | null }>;
  plot: { x: number; y: number; w: number; h: number };
  color: string;
  labelColor: string;
  scale: number;
  showValues: boolean;
}) {
  const total = Math.max(1, data.reduce((sum, datum) => sum + datum.value, 0));
  const radius = Math.min(plot.w * 0.26, plot.h * 0.42);
  const cx = plot.x + radius + 4 * (scale / PX_PER_IN);
  const cy = plot.y + plot.h / 2;
  const slices = data.reduce<
    Array<{ datum: { label: string; value: number; color?: string | null }; angle: number; rotation: number; index: number }>
  >((items, datum, index) => {
    const rotation =
      index === 0 ? -90 : items[index - 1].rotation + items[index - 1].angle;
    items.push({
      datum,
      index,
      rotation,
      angle: (datum.value / total) * 360,
    });
    return items;
  }, []);

  return (
    <>
      {slices.map(({ datum, angle, rotation, index }) => (
        <Arc
          key={`${datum.label}-${index}`}
          x={cx}
          y={cy}
          innerRadius={radius * 0.55}
          outerRadius={radius}
          angle={angle}
          rotation={rotation}
          fill={withHash(datum.color ?? color)}
        />
      ))}
      <Text
        x={cx - radius * 0.5}
        y={cy - 6 * (scale / PX_PER_IN)}
        width={radius}
        height={12 * (scale / PX_PER_IN)}
        text={String(total)}
        fontSize={10 * (scale / PX_PER_IN)}
        fontStyle="bold"
        align="center"
        fill={color}
      />
      {data.map((datum, index) => (
        <Group
          key={`${datum.label}-legend-${index}`}
          x={cx + radius + 18 * (scale / PX_PER_IN)}
          y={plot.y + index * 18 * (scale / PX_PER_IN)}
        >
          <Rect
            width={8 * (scale / PX_PER_IN)}
            height={8 * (scale / PX_PER_IN)}
            fill={withHash(datum.color ?? color)}
          />
          <Text
            x={14 * (scale / PX_PER_IN)}
            y={-1 * (scale / PX_PER_IN)}
            width={Math.max(20, plot.w - radius * 2 - 24 * (scale / PX_PER_IN))}
            height={12 * (scale / PX_PER_IN)}
            text={`${datum.label}${showValues ? ` ${datum.value}` : ""}`}
            fontSize={7.5 * (scale / PX_PER_IN)}
            fill={labelColor}
          />
        </Group>
      ))}
    </>
  );
}
