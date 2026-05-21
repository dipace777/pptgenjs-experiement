import type Konva from "konva";
import type { ReactNode } from "react";
import { Layer, Rect, Stage } from "react-konva";
import type { Slide } from "../../../../lib/slide-schema";
import { withHash } from "../../editorUtils";

export function SlideStage({
  children,
  height,
  interactive,
  slide,
  stageHandlers,
  stageRef,
  width,
}: {
  children: ReactNode;
  height: number;
  interactive: boolean;
  slide: Slide;
  stageHandlers: {
    onMouseDown: (event: Konva.KonvaEventObject<MouseEvent>) => void;
    onMouseMove: (event: Konva.KonvaEventObject<MouseEvent>) => void;
    onMouseUp: (event: Konva.KonvaEventObject<MouseEvent>) => void;
  };
  stageRef?: (stage: Konva.Stage | null) => void;
  width: number;
}) {
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
      {...stageHandlers}
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
        {children}
      </Layer>
    </Stage>
  );
}
