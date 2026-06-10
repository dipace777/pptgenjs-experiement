import { useAtomValue } from "jotai";
import type { SlideElement } from "../../../lib/slide-schema";
import { selectedElementOverflowsAtom } from "../state";
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
  const overflows = useAtomValue(selectedElementOverflowsAtom);

  const overflowBanner = overflows ? <OverflowBanner element={element} /> : null;

  if (element.type === "chart") {
    return (
      <>
        {overflowBanner}
        <ChartInspector
          element={element}
          onPatch={onPatch}
          onReplace={(next) => onReplace(selectedIndex, next)}
        />
      </>
    );
  }

  if (element.type === "text") {
    return (
      <>
        {overflowBanner}
        <TextInspector element={element} onPatch={onPatch} />
      </>
    );
  }

  if (element.type === "text-list") {
    return (
      <>
        {overflowBanner}
        <BulletsInspector element={element} onPatch={onPatch} />
      </>
    );
  }

  if (element.type === "image") {
    return <ImageInspector element={element} onPatch={onPatch} />;
  }

  if (
    element.type === "rectangle" ||
    element.type === "ellipse" ||
    element.type === "line"
  ) {
    return <ShapeInspector element={element} onPatch={onPatch} />;
  }

  if (element.type === "table") {
    return <TableInspector element={element} onPatch={onPatch} />;
  }

  if (element.type === "svg") {
    return <SvgInspector element={element} onPatch={onPatch} />;
  }

  return null;
}

function OverflowBanner({ element }: { element: SlideElement }) {
  void element;
  return (
    <div style={bannerStyle} role="status">
      <span style={bannerDotStyle}>!</span>
      <div>
        <div style={bannerTitleStyle}>Text overflows its box</div>
        <div style={bannerHintStyle}>
          Increase the height, shrink the font, or trim the text.
        </div>
      </div>
    </div>
  );
}

const bannerStyle = {
  display: "grid",
  gridTemplateColumns: "22px 1fr",
  alignItems: "start",
  gap: 8,
  padding: "10px 11px",
  marginBottom: 14,
  borderRadius: 7,
  border: "1px solid #6c1c1c",
  background: "rgba(216,59,59,0.12)",
} as const;

const bannerDotStyle = {
  width: 20,
  height: 20,
  borderRadius: 10,
  background: "#d83b3b",
  color: "#fff",
  fontSize: 12,
  fontWeight: 800,
  display: "grid",
  placeItems: "center",
  lineHeight: 1,
} as const;

const bannerTitleStyle = {
  color: "#f4d4d4",
  fontSize: 12,
  fontWeight: 800,
} as const;

const bannerHintStyle = {
  color: "#c79a9a",
  fontSize: 11,
  marginTop: 2,
  lineHeight: 1.4,
} as const;
