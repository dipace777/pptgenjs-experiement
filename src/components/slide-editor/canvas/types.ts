import type Konva from "konva";

export const SELECTION_STROKE = "#d4a24c";

export type ElementEvents = {
  draggable: boolean;
  onClick: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onDblClick?: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  onTap: () => void;
  onDragStart: () => void;
  onDragMove: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => void;
  onTransformEnd: (event: Konva.KonvaEventObject<Event>) => void;
};

export type ElementCommonProps = {
  index: number;
  scale: number;
  selected: boolean;
  editing?: boolean;
  setRef: (node: Konva.Node | null) => void;
  events: ElementEvents;
};

export function geometry(
  box: { x: number; y: number; w: number; h: number },
  scale: number,
  selected: boolean,
) {
  return {
    x: box.x * scale,
    y: box.y * scale,
    width: box.w * scale,
    height: box.h * scale,
    stroke: selected ? SELECTION_STROKE : undefined,
    strokeWidth: selected ? 1.5 : 0,
  };
}
