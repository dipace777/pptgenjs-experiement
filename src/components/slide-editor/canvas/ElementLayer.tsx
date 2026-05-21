import Konva from "konva";
import type { MutableRefObject } from "react";
import { Group, Line, Rect, Transformer } from "react-konva";
import {
  SLIDE_H,
  SLIDE_W,
  type Slide,
  type SlideElement,
} from "../../../lib/slide-schema";
import { clamp } from "../editorUtils";
import { useGroupDrag } from "./hooks/useGroupDrag";
import { KonvaElement } from "./KonvaElement";
import { SELECTION_STROKE } from "./types";

type Bounds = { x: number; y: number; width: number; height: number };

export function ElementLayer({
  editingBulletsIndex,
  editingTableIndex,
  editingTextIndex,
  interactive,
  nodeRefs,
  normalizedSelectionBox,
  onChange,
  onChangeMany,
  onDelete,
  onEditBullets,
  onEditImage,
  onEditTable,
  onEditText,
  onSelect,
  onSelectTableCell,
  scale,
  selectedBounds,
  selectedIndexes,
  slide,
  transformerRef,
  width,
  height,
}: {
  editingBulletsIndex?: number | null;
  editingTableIndex?: number | null;
  editingTextIndex?: number | null;
  interactive: boolean;
  nodeRefs: MutableRefObject<Array<Konva.Node | null>>;
  normalizedSelectionBox: Bounds | null;
  onChange?: (index: number, element: SlideElement) => void;
  onChangeMany?: (updates: Array<{ index: number; element: SlideElement }>) => void;
  onDelete?: () => void;
  onEditBullets?: (index: number) => void;
  onEditImage?: (index: number) => void;
  onEditTable?: (index: number) => void;
  onEditText?: (index: number) => void;
  onSelect?: (index: number, additive?: boolean) => void;
  onSelectTableCell?: (index: number, rowIndex: number, colIndex: number) => void;
  scale: number;
  selectedBounds: Bounds | null;
  selectedIndexes: number[];
  slide: Slide;
  transformerRef: MutableRefObject<Konva.Transformer | null>;
  width: number;
  height: number;
}) {
  const { endGroupDrag, moveGroupDrag, startGroupDrag } = useGroupDrag({
    nodeRefs,
    onChangeMany,
    scale,
    selectedIndexes,
    slide,
    transformerRef,
  });

  const commonEvents = (index: number, el: SlideElement) => ({
    draggable: interactive,
    onClick: (event: Konva.KonvaEventObject<MouseEvent>) =>
      onSelect?.(index, event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey),
    onDblClick: (event: Konva.KonvaEventObject<MouseEvent>) => {
      if (
        el.kind !== "text" &&
        el.kind !== "bullets" &&
        el.kind !== "image" &&
        el.kind !== "table"
      ) return;
      event.cancelBubble = true;
      onSelect?.(index);
      if (el.kind === "text") onEditText?.(index);
      if (el.kind === "bullets") onEditBullets?.(index);
      if (el.kind === "image") onEditImage?.(index);
      if (el.kind === "table") onEditTable?.(index);
    },
    onTap: () => onSelect?.(index),
    onDragStart: () => {
      startGroupDrag(index);
    },
    onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => {
      moveGroupDrag(index, event);
    },
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
      if (endGroupDrag(index, event)) return;
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
    <>
      {slide.elements.map((el, index) => (
        <KonvaElement
          key={index}
          element={el}
          index={index}
          scale={scale}
          selected={selectedIndexes.includes(index)}
          editing={
            editingTextIndex === index ||
            editingBulletsIndex === index ||
            editingTableIndex === index
          }
          onTableCellClick={
            el.kind === "table"
              ? (rowIndex, colIndex) => onSelectTableCell?.(index, rowIndex, colIndex)
              : undefined
          }
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
        <DeleteSelectionButton
          height={height}
          onDelete={onDelete}
          selectedBounds={selectedBounds}
          width={width}
        />
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
    </>
  );
}

function DeleteSelectionButton({
  height,
  onDelete,
  selectedBounds,
  width,
}: {
  height: number;
  onDelete: () => void;
  selectedBounds: Bounds;
  width: number;
}) {
  return (
    <Group
      x={clamp(selectedBounds.x, 4, width - 34)}
      y={clamp(selectedBounds.y + selectedBounds.height + 12, 4, height - 34)}
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
        fill="#b4232a"
        stroke="#ff8a8f"
        strokeWidth={1}
        cornerRadius={6}
        shadowColor="rgba(180,35,42,0.35)"
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
  );
}
