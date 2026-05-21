import Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { Group, Layer, Line, Rect, Stage, Transformer } from "react-konva";
import { SLIDE_H, SLIDE_W, type Slide, type SlideElement } from "../../../lib/slide-schema";
import { clamp, withHash } from "../editorUtils";
import { KonvaElement } from "./KonvaElement";
import { SELECTION_STROKE } from "./types";

export function KonvaSlide({
  slide,
  width,
  height,
  interactive,
  selected,
  selectedItems,
  onSelect,
  onSelectMany,
  onDelete,
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
  onSelectMany?: (indexes: number[]) => void;
  onDelete?: () => void;
  onChange?: (index: number, element: SlideElement) => void;
  onChangeMany?: (updates: Array<{ index: number; element: SlideElement }>) => void;
  stageRef?: (stage: Konva.Stage | null) => void;
}) {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Array<Konva.Node | null>>([]);
  const [selectionBox, setSelectionBox] = useState<{
    active: boolean;
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
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
  const selectedBounds = useMemo(() => {
    if (selectedIndexes.length === 0) return null;
    const boxes = selectedIndexes
      .map((index) => slide.elements[index])
      .filter((element): element is SlideElement => Boolean(element))
      .map((element) => ({
        x: element.x * scale,
        y: element.y * scale,
        width: element.w * scale,
        height: element.h * scale,
      }));
    if (boxes.length === 0) return null;
    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }, [scale, selectedIndexes, slide.elements]);

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

  const normalizedSelectionBox = selectionBox
    ? {
        x: Math.min(selectionBox.startX, selectionBox.x),
        y: Math.min(selectionBox.startY, selectionBox.y),
        width: Math.abs(selectionBox.width),
        height: Math.abs(selectionBox.height),
      }
    : null;

  const elementIntersectsBox = (
    element: SlideElement,
    box: { x: number; y: number; width: number; height: number },
  ) => {
    const elementBox = {
      x: element.x * scale,
      y: element.y * scale,
      width: element.w * scale,
      height: element.h * scale,
    };
    const elementCenter = {
      x: elementBox.x + elementBox.width / 2,
      y: elementBox.y + elementBox.height / 2,
    };
    const centerInside =
      elementCenter.x >= box.x &&
      elementCenter.x <= box.x + box.width &&
      elementCenter.y >= box.y &&
      elementCenter.y <= box.y + box.height;
    if (centerInside) return true;

    const overlapX = Math.max(
      0,
      Math.min(elementBox.x + elementBox.width, box.x + box.width) -
        Math.max(elementBox.x, box.x),
    );
    const overlapY = Math.max(
      0,
      Math.min(elementBox.y + elementBox.height, box.y + box.height) -
        Math.max(elementBox.y, box.y),
    );
    const elementArea = elementBox.width * elementBox.height;
    const overlapArea = overlapX * overlapY;
    return elementArea > 0 && overlapArea / elementArea >= 0.35;
  };

  const selectionRectFromPoints = (
    start: { x: number; y: number },
    end: { x: number; y: number },
  ) => ({
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  });

  const stagePointer = (stage: Konva.Stage | null) => {
    const point = stage?.getPointerPosition();
    return point ? { x: point.x, y: point.y } : null;
  };

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
        if (!interactive || event.target !== event.target.getStage()) return;
        const point = stagePointer(event.target.getStage());
        if (!point) return;
        setSelectionBox({
          active: true,
          startX: point.x,
          startY: point.y,
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
        });
      }}
      onMouseMove={(event) => {
        if (!selectionBox?.active) return;
        const point = stagePointer(event.target.getStage());
        if (!point) return;
        setSelectionBox((current) =>
          current?.active
            ? {
                ...current,
                x: point.x,
                y: point.y,
                width: point.x - current.startX,
                height: point.y - current.startY,
              }
            : current,
        );
      }}
      onMouseUp={(event) => {
        if (!selectionBox?.active) return;
        const endPoint = stagePointer(event.target.getStage());
        const box = endPoint
          ? selectionRectFromPoints(
              { x: selectionBox.startX, y: selectionBox.startY },
              endPoint,
            )
          : normalizedSelectionBox;
        setSelectionBox(null);
        if (!box || (box.width < 4 && box.height < 4)) {
          onSelect?.(-1);
          return;
        }
        const indexes = slide.elements
          .map((element, index) => ({ element, index }))
          .filter(({ element }) => elementIntersectsBox(element, box))
          .map(({ index }) => index);
        onSelectMany?.(indexes);
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
            borderStroke={SELECTION_STROKE}
            anchorFill="#f4f6fa"
            anchorStroke={SELECTION_STROKE}
            keepRatio={false}
          />
        ) : null}
        {interactive && selectedBounds && onDelete ? (
          <Group
            x={clamp(selectedBounds.x + selectedBounds.width - 34, 4, width - 34)}
            y={clamp(selectedBounds.y - 42, 4, height - 34)}
            onMouseDown={(event) => {
              event.cancelBubble = true;
            }}
            onClick={(event) => {
              event.cancelBubble = true;
              onDelete();
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              onDelete();
            }}
            onMouseEnter={(event) => {
              event.target.getStage()?.container().style.setProperty("cursor", "pointer");
            }}
            onMouseLeave={(event) => {
              event.target.getStage()?.container().style.removeProperty("cursor");
            }}
          >
            <Rect
              width={30}
              height={30}
              fill="#1f2430"
              stroke="#3a4050"
              strokeWidth={1}
              cornerRadius={6}
              shadowColor="rgba(0,0,0,0.25)"
              shadowBlur={10}
              shadowOffsetY={5}
            />
            <Line points={[9, 10, 21, 10]} stroke="#f4f6fa" strokeWidth={1.8} />
            <Line points={[12, 8, 18, 8]} stroke="#f4f6fa" strokeWidth={1.8} />
            <Rect
              x={10}
              y={12}
              width={10}
              height={10}
              stroke="#f4f6fa"
              strokeWidth={1.8}
              cornerRadius={1}
            />
            <Line points={[13, 14, 13, 20]} stroke="#f4f6fa" strokeWidth={1.2} />
            <Line points={[17, 14, 17, 20]} stroke="#f4f6fa" strokeWidth={1.2} />
          </Group>
        ) : null}
        {interactive && normalizedSelectionBox ? (
          <Rect
            x={normalizedSelectionBox.x}
            y={normalizedSelectionBox.y}
            width={normalizedSelectionBox.width}
            height={normalizedSelectionBox.height}
            fill="rgba(88, 132, 255, 0.12)"
            stroke="#6f93ff"
            strokeWidth={1}
            dash={[6, 4]}
            listening={false}
          />
        ) : null}
      </Layer>
    </Stage>
  );
}
