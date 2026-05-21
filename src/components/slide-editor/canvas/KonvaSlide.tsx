import Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { Layer, Rect, Stage, Transformer } from "react-konva";
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
            borderStroke={SELECTION_STROKE}
            anchorFill="#f4f6fa"
            anchorStroke={SELECTION_STROKE}
            keepRatio={false}
          />
        ) : null}
      </Layer>
    </Stage>
  );
}
