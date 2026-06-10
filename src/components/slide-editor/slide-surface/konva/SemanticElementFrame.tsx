import type { ReactNode } from "react";
import { Group, Rect } from "react-konva";
import {
  fillColor,
  strokeColor,
  strokeWidth as elementStrokeWidth,
} from "../../../../lib/element-model";
import {
  elementPathKey,
  type ElementPath,
  type ElementPathSegment,
  type SemanticElement,
} from "../../../../lib/semantic-elements";
import type {
  ContainerElement as ContainerEl,
  SlideElement,
} from "../../../../lib/slide-schema";
import { colorWithOpacity } from "../../editorUtils";
import { konvaCornerRadius, rotationProps, shadowProps } from "./elementVisuals";
import type { KonvaElementRenderProps } from "./elementRenderers";
import {
  geometry,
  type ElementCommonProps,
  type ElementEvents,
} from "./types";

export function SemanticElementFrame({
  childElements,
  element,
  editingNestedElement,
  index,
  scale,
  selected,
  semanticPath = [],
  semanticRootIndex = index,
  setRef,
  events,
  renderElement,
}: ElementCommonProps &
  Pick<
    KonvaElementRenderProps,
    | "bulletsRenderMode"
    | "chartRenderMode"
    | "tableRenderMode"
    | "textRenderMode"
  > & {
    childElements: SlideElement[];
    element: SemanticElement;
    renderElement: (props: KonvaElementRenderProps) => ReactNode;
}) {
  const { x, y, width, height, stroke, strokeWidth } = geometry(
    element,
    scale,
    selected,
  );
  const editingPathKey =
    editingNestedElement?.rootIndex === semanticRootIndex
      ? elementPathKey(editingNestedElement.path)
      : null;

  return (
    <Group
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      {...rotationProps(element)}
      opacity={element.opacity ?? 1}
      {...shadowProps(element.shadow, scale)}
      {...events}
    >
      <Rect width={width} height={height} fill="rgba(0,0,0,0.001)" />
      {element.type === "container" ? (
        <ContainerBackground
          element={element}
          height={height}
          scale={scale}
          width={width}
        />
      ) : null}
      <Group listening={false}>
        {childElements.map((child, childIndex) => {
          const childPath = pathForChild(element, semanticPath, childIndex);
          const childPathKey = elementPathKey(childPath);
          const isEditingChild =
            child.type === "text" && childPathKey === editingPathKey;

          return (
            <Group key={`${child.type}-${childIndex}`} listening={false}>
              {renderElement({
                element: child,
                editing: isEditingChild,
                editingNestedElement,
                index: childIndex,
                scale,
                selected: false,
                semanticPath: childPath,
                semanticRootIndex,
                setRef: noopRef,
                events: passiveEvents,
                bulletsRenderMode: "canvas",
                chartRenderMode: "canvas",
                tableRenderMode: "canvas",
                textRenderMode: "canvas",
              })}
            </Group>
          );
        })}
      </Group>
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

function pathForChild(
  element: SemanticElement,
  parentPath: ElementPath,
  childIndex: number,
): ElementPath {
  return [...parentPath, childPathSegment(element, childIndex)];
}

function childPathSegment(
  element: SemanticElement,
  childIndex: number,
): ElementPathSegment {
  if (element.type === "container") return { key: "child" };
  if (element.type === "list-view" || element.type === "grid-view") {
    return { key: "item" };
  }
  return { key: "children", index: childIndex };
}

function ContainerBackground({
  element,
  height,
  scale,
  width,
}: {
  element: ContainerEl;
  height: number;
  scale: number;
  width: number;
}) {
  if (!element.fill && !element.stroke && !element.shadow) return null;

  return (
    <Rect
      width={width}
      height={height}
      fill={
        element.fill
          ? colorWithOpacity(fillColor(element.fill), element.fill.opacity)
          : undefined
      }
      stroke={
        element.stroke
          ? colorWithOpacity(strokeColor(element.stroke), element.stroke.opacity)
          : undefined
      }
      strokeWidth={element.stroke ? elementStrokeWidth(element.stroke) : 0}
      cornerRadius={konvaCornerRadius(element, scale)}
      offsetX={0}
      offsetY={0}
      listening={false}
    />
  );
}

const passiveEvents: ElementEvents = {
  draggable: false,
  onClick: () => false,
  onDblClick: () => undefined,
  onTap: () => false,
  onMouseDown: () => undefined,
  onMouseMove: () => undefined,
  onMouseUp: () => undefined,
  onMouseLeave: () => undefined,
  onTouchStart: () => undefined,
  onTouchMove: () => undefined,
  onTouchEnd: () => undefined,
  onTouchCancel: () => undefined,
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragEnd: () => undefined,
  onTransformEnd: () => undefined,
};

function noopRef() {
  return undefined;
}
