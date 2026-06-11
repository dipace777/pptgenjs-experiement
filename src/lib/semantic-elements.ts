import {
  elementBox,
  resizeElement,
  type ElementBox,
} from "./element-model";
import type {
  ContainerElement,
  FlexElement,
  GridElement,
  GridViewElement,
  GroupElement,
  ListViewElement,
  Padding,
  Position,
  RectangleElement,
  Size,
  SlideElement,
} from "./slide-schema";

export type SemanticElement =
  | ContainerElement
  | FlexElement
  | GridElement
  | GroupElement
  | ListViewElement
  | GridViewElement;

export type ElementPathSegment =
  | { key: "child" }
  | { key: "children"; index: number }
  | { key: "item" };
export type ElementPath = ElementPathSegment[];
export type EditableDescendant = {
  element: SlideElement;
  path: ElementPath;
};

const MAX_REPEATED_VIEW_ITEMS = 60;

type SemanticFrameSource = {
  padding?: Padding | null;
  position?: Position | null;
  size?: Size | null;
};

type ComponentMetadata = Pick<
  SlideElement,
  "componentDescription" | "componentId" | "componentSlot"
>;

export function isSemanticElement(
  element: SlideElement,
): element is SemanticElement {
  return (
    element.type === "container" ||
    element.type === "flex" ||
    element.type === "grid" ||
    element.type === "group" ||
    element.type === "list-view" ||
    element.type === "grid-view"
  );
}

export function renderableChildrenForSemanticElement(
  element: SemanticElement,
): SlideElement[] {
  switch (element.type) {
    case "container":
      return layoutContainerChildren(element);
    case "flex":
      return layoutFlexChildren(element, element.children);
    case "grid":
      return layoutGridChildren(element, element.children);
    case "group":
      return element.children;
    case "list-view":
      return layoutListViewChildren(element);
    case "grid-view":
      return layoutGridViewChildren(element);
  }
}

export function elementWithOffset(
  element: SlideElement,
  dx: number,
  dy: number,
): SlideElement {
  const copy = cloneElement(element);
  const box = elementBox(copy);
  return resizeElement(copy, {
    x: box.x + dx,
    y: box.y + dy,
  });
}

export function editableElementsForInsertion(
  elements: readonly SlideElement[],
): SlideElement[] {
  return elements.flatMap((element) =>
    materializeEditableElements(cloneElement(element), metadataFrom(element), 0, 0, 1),
  );
}

export function editableDescendantsForSemanticElement(
  element: SlideElement,
): EditableDescendant[] {
  return descendantsForElement(cloneElement(element), [], 0, 0, 1);
}

export function elementPathKey(path: ElementPath): string {
  return path
    .map((segment) =>
      segment.key === "children" ? `children:${segment.index}` : segment.key,
    )
    .join("/");
}

export function updateElementAtPath(
  element: SlideElement,
  path: ElementPath,
  update: (element: SlideElement) => SlideElement,
): SlideElement {
  if (path.length === 0) return update(element);
  const [segment, ...rest] = path;
  if (!segment) return element;

  if (segment.key === "child" && element.type === "container" && element.child) {
    return {
      ...element,
      child: updateElementAtPath(element.child, rest, update),
    };
  }

  if (segment.key === "item" && (element.type === "list-view" || element.type === "grid-view")) {
    return {
      ...element,
      item: updateElementAtPath(element.item, rest, update),
    };
  }

  if (
    segment.key === "children" &&
    (element.type === "group" || element.type === "flex" || element.type === "grid")
  ) {
    return {
      ...element,
      children: element.children.map((child, index) =>
        index === segment.index ? updateElementAtPath(child, rest, update) : child,
      ),
    };
  }

  return element;
}

export function hasContainerBackground(element: ContainerElement): boolean {
  return Boolean(element.fill || element.stroke || element.shadow);
}

function materializeEditableElements(
  element: SlideElement,
  metadata: ComponentMetadata,
  dx: number,
  dy: number,
  inheritedOpacity: number,
): SlideElement[] {
  if (!isSemanticElement(element)) {
    return [
      applyComponentMetadata(
        applyInheritedOpacity(elementWithOffset(element, dx, dy), inheritedOpacity),
        metadata,
      ),
    ];
  }

  const box = elementBox(element);
  const nextDx = dx + box.x;
  const nextDy = dy + box.y;
  const ownOpacity = inheritedOpacity * (element.opacity ?? 1);
  const elements: SlideElement[] = [];

  if (element.type === "container" && hasContainerBackground(element)) {
    elements.push(
      applyComponentMetadata(
        containerBackgroundElement(element, nextDx, nextDy, inheritedOpacity),
        metadata,
      ),
    );
  }

  for (const child of renderableChildrenForSemanticElement(element)) {
    elements.push(
      ...materializeEditableElements(child, metadata, nextDx, nextDy, ownOpacity),
    );
  }

  return elements;
}

function descendantsForElement(
  element: SlideElement,
  path: ElementPath,
  dx: number,
  dy: number,
  inheritedOpacity: number,
): EditableDescendant[] {
  if (!isSemanticElement(element)) {
    return [
      {
        element: applyInheritedOpacity(elementWithOffset(element, dx, dy), inheritedOpacity),
        path,
      },
    ];
  }

  const box = elementBox(element);
  const nextDx = dx + box.x;
  const nextDy = dy + box.y;
  const ownOpacity = inheritedOpacity * (element.opacity ?? 1);

  if (element.type === "container") {
    const child = renderableChildrenForSemanticElement(element)[0];
    return child
      ? descendantsForElement(child, [...path, { key: "child" }], nextDx, nextDy, ownOpacity)
      : [];
  }

  if (element.type === "list-view" || element.type === "grid-view") {
    return renderableChildrenForSemanticElement(element).flatMap((child) =>
      descendantsForElement(child, [...path, { key: "item" }], nextDx, nextDy, ownOpacity),
    );
  }

  const children = renderableChildrenForSemanticElement(element);
  return children.flatMap((child, index) =>
    descendantsForElement(
      child,
      [...path, { key: "children", index }],
      nextDx,
      nextDy,
      ownOpacity,
    ),
  );
}

function containerBackgroundElement(
  element: ContainerElement,
  x: number,
  y: number,
  inheritedOpacity: number,
): RectangleElement {
  return {
    type: "rectangle",
    position: { x, y },
    size: {
      width: elementBox(element).w,
      height: elementBox(element).h,
    },
    fill: element.fill,
    stroke: element.stroke,
    borderRadius: element.borderRadius,
    opacity:
      inheritedOpacity < 1 || element.opacity != null
        ? inheritedOpacity * (element.opacity ?? 1)
        : undefined,
    shadow: element.shadow,
    rotation: element.rotation,
  };
}

function metadataFrom(element: SlideElement): ComponentMetadata {
  return {
    componentDescription: element.componentDescription,
    componentId: element.componentId,
    componentSlot: element.componentSlot,
  };
}

function applyComponentMetadata<T extends SlideElement>(
  element: T,
  metadata: ComponentMetadata,
): T {
  const next = { ...element } as T;
  if (metadata.componentId) next.componentId = metadata.componentId;
  else delete next.componentId;
  if (metadata.componentDescription) {
    next.componentDescription = metadata.componentDescription;
  } else {
    delete next.componentDescription;
  }
  if (metadata.componentSlot) next.componentSlot = metadata.componentSlot;
  else delete next.componentSlot;
  delete next.componentInstanceId;
  return next;
}

function applyInheritedOpacity(
  element: SlideElement,
  inheritedOpacity: number,
): SlideElement {
  if (inheritedOpacity >= 1) return element;
  return {
    ...element,
    opacity: (element.opacity ?? 1) * inheritedOpacity,
  } as SlideElement;
}

function layoutContainerChildren(element: ContainerElement): SlideElement[] {
  if (!element.child) return [];
  const child = cloneElement(element.child);
  if (hasExplicitFrame(child)) return [child];

  const content = semanticContentBox(element);
  const childBox = elementBox(child);
  return [
    resizeElement(child, {
      x: child.position?.x ?? content.x,
      y: child.position?.y ?? content.y,
      w: child.size?.width ?? Math.max(0.01, content.w - Math.max(0, childBox.x - content.x)),
      h: child.size?.height ?? Math.max(0.01, content.h - Math.max(0, childBox.y - content.y)),
    }),
  ];
}

function layoutFlexChildren(
  element: Pick<
    FlexElement | ListViewElement,
    | "direction"
    | "alignItems"
    | "justifyContent"
    | "padding"
    | "gap"
    | "columnGap"
    | "rowGap"
    | "position"
    | "size"
  >,
  children: SlideElement[],
): SlideElement[] {
  if (children.length === 0) return [];

  const direction = element.direction ?? "column";
  const isRow = direction === "row";
  const content = semanticContentBox(element);
  const gap = Math.max(
    0,
    (isRow ? element.columnGap : element.rowGap) ?? element.gap ?? 0,
  );
  const mainAvailable = isRow ? content.w : content.h;
  const crossAvailable = isRow ? content.h : content.w;
  const gapTotal = gap * Math.max(0, children.length - 1);
  const knownMainSizes = children.map((child) => childMainSize(child, isRow));
  const knownTotal = knownMainSizes.reduce<number>(
    (sum, value) => sum + (value ?? 0),
    0,
  );
  const missingCount = knownMainSizes.filter((value) => value == null).length;
  const fallbackMain =
    missingCount > 0
      ? Math.max(0.01, (mainAvailable - gapTotal - knownTotal) / missingCount)
      : 0;
  const mainSizes: number[] = knownMainSizes.map((value) =>
    Math.max(0.01, value ?? fallbackMain),
  );
  const usedMain =
    mainSizes.reduce((sum, value) => sum + value, 0) + gapTotal;
  const mainStart = justifiedStart(
    element.justifyContent,
    isRow ? content.x : content.y,
    mainAvailable,
    usedMain,
  );

  let cursor = mainStart;
  return children.map((item, index) => {
    const child = cloneElement(item);
    const explicit = elementBox(child);
    const align = child.layout?.alignSelf ?? element.alignItems ?? "stretch";
    const explicitCross = child.size
      ? isRow
        ? child.size.height
        : child.size.width
      : null;
    const crossSize =
      align === "stretch" || explicitCross == null
        ? crossAvailable
        : Math.min(crossAvailable, explicitCross);
    const crossStart = alignedStart(
      align,
      isRow ? content.y : content.x,
      crossAvailable,
      crossSize,
    );
    const frame = isRow
      ? {
          x: cursor,
          y: crossStart,
          w: mainSizes[index] ?? explicit.w,
          h: crossSize,
        }
      : {
          x: crossStart,
          y: cursor,
          w: crossSize,
          h: mainSizes[index] ?? explicit.h,
        };
    cursor += (mainSizes[index] ?? 0) + gap;
    return resizeElement(child, frame);
  });
}

function layoutGridChildren(
  element: Pick<
    GridElement | GridViewElement,
    | "columns"
    | "rows"
    | "alignItems"
    | "justifyItems"
    | "padding"
    | "gap"
    | "columnGap"
    | "rowGap"
    | "position"
    | "size"
  >,
  children: SlideElement[],
): SlideElement[] {
  if (children.length === 0) return [];

  const columns = clampInt(element.columns, 1, 12);
  const rows = Math.max(
    clampInt(element.rows ?? 1, 1, 24),
    Math.ceil(children.length / columns),
  );
  const content = semanticContentBox(element);
  const columnGap = Math.max(0, element.columnGap ?? element.gap ?? 0);
  const rowGap = Math.max(0, element.rowGap ?? element.gap ?? 0);
  const cellW = Math.max(0.01, (content.w - columnGap * (columns - 1)) / columns);
  const cellH = Math.max(0.01, (content.h - rowGap * (rows - 1)) / rows);

  return children.map((item, index) => {
    const child = cloneElement(item);
    const row = Math.floor(index / columns);
    const column = index % columns;
    const columnSpan = clampInt(child.layout?.columnSpan ?? 1, 1, columns - column);
    const rowSpan = clampInt(child.layout?.rowSpan ?? 1, 1, rows - row);
    const area: ElementBox = {
      x: content.x + column * (cellW + columnGap),
      y: content.y + row * (cellH + rowGap),
      w: cellW * columnSpan + columnGap * (columnSpan - 1),
      h: cellH * rowSpan + rowGap * (rowSpan - 1),
    };
    const justify = element.justifyItems ?? "flex-start";
    const align = child.layout?.alignSelf ?? element.alignItems ?? "flex-start";
    const childW =
      justify === "stretch" || !child.size
        ? area.w
        : Math.min(area.w, child.size.width);
    const childH =
      align === "stretch" || !child.size
        ? area.h
        : Math.min(area.h, child.size.height);
    return resizeElement(child, {
      x: alignedStart(justify, area.x, area.w, childW),
      y: alignedStart(align, area.y, area.h, childH),
      w: childW,
      h: childH,
    });
  });
}

function layoutListViewChildren(element: ListViewElement): SlideElement[] {
  const count = repeatedItemCount(element.count, element.maxCount);
  const children = Array.from({ length: count }, () => cloneElement(element.item));
  return layoutFlexChildren(element, children);
}

function layoutGridViewChildren(element: GridViewElement): SlideElement[] {
  const count = repeatedItemCount(element.count, element.maxCount);
  const children = Array.from({ length: count }, () => cloneElement(element.item));
  return layoutGridChildren(element, children);
}

function semanticContentBox(element: SemanticFrameSource): ElementBox {
  const box = elementBox(element);
  const padding = normalizedPadding(element.padding);
  return {
    x: padding.left,
    y: padding.top,
    w: Math.max(0.01, box.w - padding.left - padding.right),
    h: Math.max(0.01, box.h - padding.top - padding.bottom),
  };
}

function normalizedPadding(padding?: Padding | null): Padding {
  return {
    top: Math.max(0, padding?.top ?? 0),
    right: Math.max(0, padding?.right ?? 0),
    bottom: Math.max(0, padding?.bottom ?? 0),
    left: Math.max(0, padding?.left ?? 0),
  };
}

function childMainSize(child: SlideElement, isRow: boolean): number | null {
  if (child.layout?.basis != null) return child.layout.basis;
  if (!child.size) return null;
  return isRow ? child.size.width : child.size.height;
}

function justifiedStart(
  justify: FlexElement["justifyContent"],
  start: number,
  available: number,
  used: number,
): number {
  const slack = Math.max(0, available - used);
  if (justify === "center") return start + slack / 2;
  if (justify === "flex-end") return start + slack;
  return start;
}

function alignedStart(
  align: FlexElement["alignItems"] | GridElement["justifyItems"],
  start: number,
  available: number,
  used: number,
): number {
  const slack = Math.max(0, available - used);
  if (align === "center") return start + slack / 2;
  if (align === "flex-end") return start + slack;
  return start;
}

function hasExplicitFrame(element: SlideElement): boolean {
  return element.position != null && element.size != null;
}

function repeatedItemCount(count: number, maxCount?: number | null): number {
  return clampInt(count, 0, Math.min(maxCount ?? MAX_REPEATED_VIEW_ITEMS, MAX_REPEATED_VIEW_ITEMS));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function cloneElement(element: SlideElement): SlideElement {
  return JSON.parse(JSON.stringify(element)) as SlideElement;
}
