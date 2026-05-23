import type { SlideElement } from "../../../lib/slide-schema";
import { getElementDefinition } from "../registry";
import { ChartInspector } from "./ChartInspector";
import {
  BulletsInspector,
  ImageInspector,
  ShapeInspector,
  SvgInspector,
  TableInspector,
  TextInspector,
} from "./KindInspectors";

type ElementInspectorProps = {
  element: SlideElement;
  selectedIndex: number;
  onPatch: (patch: Partial<SlideElement>) => void;
  onReplace: (index: number, element: SlideElement) => void;
};

export function ElementInspector({
  element,
  selectedIndex,
  onPatch,
  onReplace,
}: ElementInspectorProps) {
  const inspector = getElementDefinition(element.kind).inspector;

  if (inspector === "chart" && element.kind === "chart") {
    return (
      <ChartInspector
        element={element}
        onPatch={onPatch}
        onReplace={(next) => onReplace(selectedIndex, next)}
      />
    );
  }

  if (inspector === "text" && element.kind === "text") {
    return <TextInspector element={element} onPatch={onPatch} />;
  }

  if (inspector === "bullets" && element.kind === "bullets") {
    return <BulletsInspector element={element} onPatch={onPatch} />;
  }

  if (inspector === "image" && element.kind === "image") {
    return <ImageInspector element={element} onPatch={onPatch} />;
  }

  if (
    inspector === "shape" &&
    (element.kind === "rect" || element.kind === "ellipse")
  ) {
    return <ShapeInspector element={element} onPatch={onPatch} />;
  }

  if (inspector === "table" && element.kind === "table") {
    return <TableInspector element={element} onPatch={onPatch} />;
  }

  if (inspector === "svg" && element.kind === "svg") {
    return <SvgInspector element={element} onPatch={onPatch} />;
  }

  return null;
}
