/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import Konva from "konva";
import PptxGenJS from "pptxgenjs";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Arc,
  Ellipse,
  Group,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
  Transformer,
} from "react-konva";
import { generatePptx } from "../slide/generatePptx";
import {
  SLIDE_H,
  SLIDE_W,
  messiDeck,
  type Deck,
  type Slide,
  type SlideElement,
} from "../slide/spec";

export const Route = createFileRoute("/editable")({
  component: RouteComponent,
});

const PX_PER_IN = 96;
const PT_TO_PX = 96 / 72;
const STAGE_W = 960;
const EXPORT_W = 1600;
const EXPORT_H = EXPORT_W * (SLIDE_H / SLIDE_W);

function withHash(color: string) {
  return color.startsWith("#") ? color : `#${color}`;
}

function withoutHash(color: string) {
  return color.replace("#", "").toUpperCase();
}

function filenameFromTitle(title: string, suffix = "") {
  const slug =
    title.toLowerCase().replace(/\W+/g, "-").replace(/^-|-$/g, "") ||
    "editable-deck";
  return `${slug}${suffix}.pptx`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function kindLabel(kind: SlideElement["kind"]) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function RouteComponent() {
  const [deck, setDeck] = useState<Deck>(messiDeck);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [exportMode, setExportMode] = useState<"native" | "raster">("native");
  const [isExporting, setIsExporting] = useState(false);
  const [stageWidth, setStageWidth] = useState(STAGE_W);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const exportStageRefs = useRef<Array<Konva.Stage | null>>([]);

  const activeSlide = deck.slides[active];
  const selectedIndex =
    selected >= 0
      ? Math.min(selected, Math.max(0, (activeSlide?.elements.length ?? 1) - 1))
      : -1;
  const selectedElement =
    selectedIndex >= 0 ? (activeSlide?.elements[selectedIndex] ?? null) : null;

  useEffect(() => {
    const node = stageWrapRef.current;
    if (!node) return;
    const measure = () => {
      setStageWidth(clamp(node.clientWidth, 460, STAGE_W));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    measure();
    return () => observer.disconnect();
  }, []);

  const updateSlide = (slideIndex: number, updater: (slide: Slide) => Slide) => {
    setDeck((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === slideIndex ? updater(slide) : slide,
      ),
    }));
  };

  const updateActiveSlide = (updater: (slide: Slide) => Slide) => {
    updateSlide(active, updater);
  };

  const updateElement = (index: number, next: SlideElement) => {
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.map((el, i) => (i === index ? next : el)),
    }));
  };

  const patchSelected = (patch: Partial<SlideElement>) => {
    if (!selectedElement) return;
    updateElement(selectedIndex, { ...selectedElement, ...patch } as SlideElement);
  };

  const addElement = (kind: SlideElement["kind"]) => {
    const base = { x: 0.8, y: 0.8, w: 2.6, h: 0.7 };
    const next: SlideElement =
      kind === "rect"
        ? { ...base, kind, fill: "D4A24C", rx: 0.08 }
        : kind === "ellipse"
          ? { ...base, kind, fill: "75AADB" }
          : kind === "chart"
            ? {
                ...base,
                w: 4.2,
                h: 1.8,
                kind,
                chartType: "bar",
                title: "Chart title",
                color: "D4A24C",
                axisColor: "9AA7BD",
                labelColor: "6A7894",
                showValues: true,
                data: [
                  { label: "A", value: 42, color: "D4A24C" },
                  { label: "B", value: 68, color: "3E78B2" },
                  { label: "C", value: 54, color: "0B1F3A" },
                ],
              }
          : kind === "bullets"
            ? {
                ...base,
                h: 1.35,
                kind,
                items: ["First point", "Second point"],
                fontFace: "Arial",
                fontSize: 18,
                color: "1A2B45",
              }
            : {
                ...base,
                w: 4.2,
                h: 0.7,
                kind,
                text: "New text",
                fontFace: "Arial",
                fontSize: 28,
                bold: true,
                color: "1A2B45",
              };
    updateActiveSlide((slide) => {
      setSelected(slide.elements.length);
      setEditorOpen(true);
      return { ...slide, elements: [...slide.elements, next] };
    });
  };

  const duplicateSelected = () => {
    if (!selectedElement) return;
    const copy = {
      ...selectedElement,
      x: clamp(selectedElement.x + 0.2, 0, SLIDE_W - selectedElement.w),
      y: clamp(selectedElement.y + 0.2, 0, SLIDE_H - selectedElement.h),
    } as SlideElement;
    updateActiveSlide((slide) => {
      setSelected(selectedIndex + 1);
      return {
        ...slide,
        elements: [
          ...slide.elements.slice(0, selectedIndex + 1),
          copy,
          ...slide.elements.slice(selectedIndex + 1),
        ],
      };
    });
  };

  const deleteSelected = () => {
    if (!selectedElement || activeSlide.elements.length <= 1) return;
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.filter((_, index) => index !== selectedIndex),
    }));
    setSelected((index) => Math.max(0, index - 1));
  };

  const handleNativeExport = async () => {
    await generatePptx(deck, filenameFromTitle(deck.title));
  };

  const handleRasterExport = async () => {
    const pptx = new PptxGenJS();
    pptx.defineLayout({ name: "KONVA_16X9", width: SLIDE_W, height: SLIDE_H });
    pptx.layout = "KONVA_16X9";
    pptx.author = "ppty";
    pptx.subject = "Rasterized Konva deck";
    pptx.title = deck.title;

    for (let i = 0; i < deck.slides.length; i += 1) {
      const data = exportStageRefs.current[i]?.toDataURL({
        pixelRatio: 1,
        mimeType: "image/png",
      });
      const slide = pptx.addSlide();
      if (data) {
        slide.addImage({ data, x: 0, y: 0, w: SLIDE_W, h: SLIDE_H });
      }
    }

    await pptx.writeFile({ fileName: filenameFromTitle(deck.title, "-raster") });
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (exportMode === "native") {
        await handleNativeExport();
      } else {
        await handleRasterExport();
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>INTERNAL JSON</div>
          <input
            aria-label="Deck title"
            value={deck.title}
            onChange={(event) =>
              setDeck((current) => ({ ...current, title: event.target.value }))
            }
            style={styles.titleInput}
          />
          <div style={styles.meta}>{deck.slides.length} slides</div>
        </div>

        <div style={styles.thumbs}>
          {deck.slides.map((slide, index) => (
            <button
              key={index}
              type="button"
              onClick={() => {
                setActive(index);
                setSelected(0);
              }}
              style={{
                ...styles.thumbRow,
                borderColor: index === active ? "#d4a24c" : "#242c3e",
              }}
            >
              <span style={styles.thumbNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <KonvaSlide
                slide={slide}
                width={160}
                height={90}
                interactive={false}
              />
            </button>
          ))}
        </div>
      </aside>

      <main style={styles.main}>
        <div style={styles.topbar}>
          <div>
            <div style={styles.currentTitle}>
              {activeSlide.title ?? `Slide ${active + 1}`}
            </div>
            <div style={styles.meta}>
              React + Konva live preview; JSON remains the source of truth.
            </div>
          </div>
          <div style={styles.toolbar}>
            <Segmented
              value={exportMode}
              options={[
                ["native", "Native"],
                ["raster", "Raster"],
              ]}
              onChange={(value) => setExportMode(value)}
            />
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExport}
              style={styles.primaryButton}
            >
              {isExporting ? "Exporting..." : "Export PPTX"}
            </button>
          </div>
        </div>

        <section style={styles.workArea}>
          <div ref={stageWrapRef} style={styles.stagePanel}>
            <div
              style={{
                ...styles.slideFrame,
                width: stageWidth,
                height: stageWidth * (SLIDE_H / SLIDE_W),
              }}
            >
              <button
                type="button"
                onClick={() => setEditorOpen(true)}
                style={styles.slideEditButton}
              >
                Edit
              </button>
              <KonvaSlide
                slide={activeSlide}
                width={stageWidth}
                height={stageWidth * (SLIDE_H / SLIDE_W)}
                interactive
                selected={selectedIndex}
                onSelect={setSelected}
                onChange={updateElement}
              />
            </div>
          </div>
        </section>
      </main>

      {editorOpen ? (
        <div
          aria-modal="true"
          role="dialog"
          style={styles.drawerBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setEditorOpen(false);
          }}
        >
          <aside style={styles.drawer}>
            <div style={styles.inspectorHeader}>
              <div>
                <div style={styles.eyebrow}>
                  SLIDE {String(active + 1).padStart(2, "0")}
                </div>
                <h2 style={styles.inspectorTitle}>
                  {selectedElement
                    ? kindLabel(selectedElement.kind)
                    : "Nothing selected"}
                </h2>
              </div>
              <div style={styles.iconRow}>
                <button
                  type="button"
                  title="Duplicate"
                  onClick={duplicateSelected}
                  style={styles.iconButton}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={deleteSelected}
                  style={styles.iconButton}
                >
                  ×
                </button>
                <button
                  type="button"
                  title="Close editor"
                  onClick={() => setEditorOpen(false)}
                  style={styles.iconButton}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={styles.drawerHint}>
              Select an object on the slide, then adjust it here.
            </div>

            {selectedElement ? (
              <Inspector
                element={selectedElement}
                onPatch={patchSelected}
                onReplace={(next) => updateElement(selectedIndex, next)}
              />
            ) : null}

            <div style={styles.addGrid}>
              {(["text", "rect", "ellipse", "bullets", "chart"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => addElement(kind)}
                  style={styles.secondaryButton}
                >
                  + {kindLabel(kind)}
                </button>
              ))}
            </div>
          </aside>
        </div>
      ) : null}

      <div style={styles.hiddenStages} aria-hidden="true">
        {deck.slides.map((slide, index) => (
          <KonvaSlide
            key={index}
            slide={slide}
            width={EXPORT_W}
            height={EXPORT_H}
            interactive={false}
            stageRef={(node) => {
              exportStageRefs.current[index] = node;
            }}
          />
        ))}
      </div>
    </div>
  );
}

function KonvaSlide({
  slide,
  width,
  height,
  interactive,
  selected,
  onSelect,
  onChange,
  stageRef,
}: {
  slide: Slide;
  width: number;
  height: number;
  interactive: boolean;
  selected?: number;
  onSelect?: (index: number) => void;
  onChange?: (index: number, element: SlideElement) => void;
  stageRef?: (stage: Konva.Stage | null) => void;
}) {
  const transformerRef = useRef<Konva.Transformer | null>(null);
  const nodeRefs = useRef<Array<Konva.Node | null>>([]);
  const scale = width / SLIDE_W;

  useEffect(() => {
    if (!interactive || selected == null) return;
    const transformer = transformerRef.current;
    const node = nodeRefs.current[selected];
    if (!transformer || !node) return;
    transformer.nodes([node]);
    transformer.getLayer()?.batchDraw();
  }, [interactive, selected, slide]);

  const commonEvents = (index: number, el: SlideElement) => ({
    draggable: interactive,
    onClick: () => onSelect?.(index),
    onTap: () => onSelect?.(index),
    onDragEnd: (event: Konva.KonvaEventObject<DragEvent>) => {
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
            selected={selected === index}
            setRef={(node) => {
              nodeRefs.current[index] = node;
            }}
            events={commonEvents(index, el)}
          />
        ))}
        {interactive && selected != null && selected >= 0 ? (
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
    onClick: () => void;
    onTap: () => void;
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
            scale={scale}
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

  const fontSize =
    element.kind === "bullets"
      ? element.fontSize * PT_TO_PX * (scale / PX_PER_IN)
      : element.fontSize * PT_TO_PX * (scale / PX_PER_IN);
  const text =
    element.kind === "bullets"
      ? element.items.map((item) => `• ${item}`).join("\n")
      : element.text;

  return (
    <Text
      ref={setRef}
      name={`element-${index}`}
      x={x}
      y={y}
      width={width}
      height={height}
      text={text}
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
      lineHeight={
        element.kind === "bullets"
          ? (element.lineSpacingMultiple ?? 1.3)
          : (element.lineHeight ?? 1.15)
      }
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
  scale,
}: {
  data: Array<{ label: string; value: number; color?: string | null }>;
  max: number;
  plot: { x: number; y: number; w: number; h: number };
  color: string;
  axisColor: string;
  scale: number;
}) {
  const points = data.flatMap((datum, index) => [
    plot.x + (data.length === 1 ? 0 : (index / (data.length - 1)) * plot.w),
    plot.y + plot.h - (datum.value / max) * plot.h * 0.82,
  ]);
  return (
    <>
      <Line points={[plot.x, plot.y + plot.h, plot.x + plot.w, plot.y + plot.h]} stroke={axisColor} strokeWidth={1} />
      <Line points={[plot.x, plot.y, plot.x, plot.y + plot.h]} stroke={axisColor} strokeWidth={1} />
      <Line points={points} stroke={color} strokeWidth={2} tension={0.28} />
      {data.map((datum, index) => {
        const cx =
          plot.x + (data.length === 1 ? 0 : (index / (data.length - 1)) * plot.w);
        const cy = plot.y + plot.h - (datum.value / max) * plot.h * 0.82;
        return (
          <Ellipse
            key={`${datum.label}-${index}`}
            x={cx}
            y={cy}
            radiusX={3.5 * (scale / PX_PER_IN)}
            radiusY={3.5 * (scale / PX_PER_IN)}
            fill={withHash(datum.color ?? color)}
            stroke="#ffffff"
            strokeWidth={1}
          />
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

function Inspector({
  element,
  onPatch,
  onReplace,
}: {
  element: SlideElement;
  onPatch: (patch: Partial<SlideElement>) => void;
  onReplace: (next: SlideElement) => void;
}) {
  return (
    <form
      onSubmit={(event) => event.preventDefault()}
      style={styles.form}
    >
      <div style={styles.grid2}>
        <NumberField label="X" value={element.x} onChange={(x) => onPatch({ x })} />
        <NumberField label="Y" value={element.y} onChange={(y) => onPatch({ y })} />
        <NumberField label="W" value={element.w} onChange={(w) => onPatch({ w })} />
        <NumberField label="H" value={element.h} onChange={(h) => onPatch({ h })} />
      </div>

      {element.kind === "text" ? (
        <>
          <Field label="Text">
            <textarea
              value={element.text}
              rows={4}
              onChange={(event) => onPatch({ text: event.target.value })}
              style={styles.textarea}
            />
          </Field>
          <div style={styles.grid2}>
            <NumberField
              label="Font"
              value={element.fontSize}
              step={1}
              onChange={(fontSize) => onPatch({ fontSize })}
            />
            <ColorField
              label="Color"
              value={element.color}
              onChange={(color) => onPatch({ color })}
            />
          </div>
          <div style={styles.toggleRow}>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={element.bold ?? false}
                onChange={(event) => onPatch({ bold: event.target.checked })}
              />
              Bold
            </label>
            <label style={styles.checkLabel}>
              <input
                type="checkbox"
                checked={element.italic ?? false}
                onChange={(event) => onPatch({ italic: event.target.checked })}
              />
              Italic
            </label>
          </div>
        </>
      ) : null}

      {element.kind === "bullets" ? (
        <>
          <Field label="Bullet items">
            <textarea
              value={element.items.join("\n")}
              rows={5}
              onChange={(event) =>
                onReplace({
                  ...element,
                  items: event.target.value
                    .split("\n")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 8),
                })
              }
              style={styles.textarea}
            />
          </Field>
          <div style={styles.grid2}>
            <NumberField
              label="Font"
              value={element.fontSize}
              step={1}
              onChange={(fontSize) => onPatch({ fontSize })}
            />
            <ColorField
              label="Color"
              value={element.color}
              onChange={(color) => onPatch({ color })}
            />
          </div>
        </>
      ) : null}

      {element.kind === "chart" ? (
        <>
          <div style={styles.grid2}>
            <Field label="Chart type">
              <select
                value={element.chartType}
                onChange={(event) =>
                  onPatch({
                    chartType: event.target.value as "bar" | "line" | "donut",
                  })
                }
                style={styles.input}
              >
                <option value="bar">Bar</option>
                <option value="line">Line</option>
                <option value="donut">Donut</option>
              </select>
            </Field>
            <ColorField
              label="Color"
              value={element.color}
              onChange={(color) => onPatch({ color })}
            />
          </div>
          <Field label="Title">
            <input
              value={element.title ?? ""}
              onChange={(event) => onPatch({ title: event.target.value })}
              style={styles.input}
            />
          </Field>
          <Field label="Data">
            <textarea
              value={element.data
                .map(
                  (datum) =>
                    `${datum.label}, ${datum.value}${datum.color ? `, ${datum.color}` : ""}`,
                )
                .join("\n")}
              rows={5}
              onChange={(event) => {
                const data = event.target.value
                  .split("\n")
                  .map((line) => {
                    const [label, value, color] = line
                      .split(",")
                      .map((part) => part.trim());
                    return {
                      label,
                      value: Number(value) || 0,
                      color: color ? withoutHash(color) : undefined,
                    };
                  })
                  .filter((datum) => datum.label)
                  .slice(0, 8);
                if (data.length > 0) onReplace({ ...element, data });
              }}
              style={styles.textarea}
            />
          </Field>
          <label style={styles.checkLabel}>
            <input
              type="checkbox"
              checked={element.showValues ?? false}
              onChange={(event) => onPatch({ showValues: event.target.checked })}
            />
            Show values
          </label>
        </>
      ) : null}

      {element.kind === "rect" || element.kind === "ellipse" ? (
        <div style={styles.grid2}>
          <ColorField
            label="Fill"
            value={element.fill}
            onChange={(fill) => onPatch({ fill })}
          />
          {element.kind === "rect" ? (
            <NumberField
              label="Radius"
              value={element.rx ?? 0}
              step={0.02}
              onChange={(rx) => onPatch({ rx })}
            />
          ) : null}
        </div>
      ) : null}

      {"opacity" in element ? (
        <NumberField
          label="Opacity"
          value={element.opacity ?? 1}
          min={0}
          max={1}
          step={0.05}
          onChange={(opacity) => onPatch({ opacity })}
        />
      ) : null}
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  min = 0,
  max = 99,
  step = 0.05,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={Number(value.toFixed(3))}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        style={styles.input}
      />
    </Field>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="color"
        value={withHash(value)}
        onChange={(event) => onChange(withoutHash(event.target.value))}
        style={styles.colorInput}
      />
    </Field>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div style={styles.segmented}>
      {options.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          style={{
            ...styles.segment,
            background: id === value ? "#d4a24c" : "transparent",
            color: id === value ? "#071425" : "#9aa7bd",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const baseFont =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

const styles = {
  shell: {
    display: "flex",
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    background: "#0a0d14",
    color: "#e6ebf5",
    fontFamily: baseFont,
  },
  sidebar: {
    width: 230,
    flexShrink: 0,
    borderRight: "1px solid #20283a",
    background: "#10141e",
    display: "flex",
    flexDirection: "column",
  },
  header: { padding: 18, borderBottom: "1px solid #20283a" },
  eyebrow: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.8,
    color: "#6a7894",
  },
  titleInput: {
    marginTop: 8,
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#f4f6fa",
    fontSize: 18,
    fontWeight: 700,
    outline: "none",
    padding: 0,
  },
  meta: { marginTop: 4, fontSize: 12, color: "#7d89a3" },
  thumbs: { flex: 1, overflowY: "auto", padding: 14, display: "grid", gap: 12 },
  thumbRow: {
    display: "grid",
    gridTemplateColumns: "22px 1fr",
    alignItems: "center",
    gap: 8,
    width: "100%",
    padding: 6,
    border: "1px solid #242c3e",
    borderRadius: 7,
    background: "#0c1019",
    color: "#e6ebf5",
    cursor: "pointer",
  },
  thumbNumber: {
    color: "#7d89a3",
    fontSize: 11,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
  },
  main: { flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  topbar: {
    height: 62,
    flexShrink: 0,
    padding: "0 22px",
    borderBottom: "1px solid #20283a",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 18,
  },
  currentTitle: { fontSize: 15, fontWeight: 700, color: "#f4f6fa" },
  toolbar: { display: "inline-flex", alignItems: "center", gap: 10 },
  primaryButton: {
    height: 36,
    padding: "0 14px",
    borderRadius: 7,
    border: "none",
    background: "#d4a24c",
    color: "#071425",
    fontWeight: 800,
    cursor: "pointer",
  },
  workArea: {
    flex: 1,
    minHeight: 0,
    display: "flex",
  },
  stagePanel: {
    minWidth: 0,
    minHeight: 0,
    padding: 28,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  slideFrame: {
    position: "relative",
    flexShrink: 0,
  },
  slideEditButton: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 5,
    height: 34,
    padding: "0 14px",
    borderRadius: 7,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(16,20,30,0.88)",
    color: "#f4f6fa",
    boxShadow: "0 10px 28px rgba(0,0,0,0.28)",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  inspector: {
    borderLeft: "1px solid #20283a",
    background: "#10141e",
    padding: 18,
    overflowY: "auto",
  },
  drawerBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 30,
    display: "flex",
    justifyContent: "flex-end",
    background: "rgba(3, 7, 18, 0.5)",
  },
  drawer: {
    width: 360,
    maxWidth: "calc(100vw - 28px)",
    height: "100%",
    boxSizing: "border-box",
    borderLeft: "1px solid #273044",
    background: "#10141e",
    boxShadow: "-24px 0 70px rgba(0,0,0,0.44)",
    padding: 18,
    overflowY: "auto",
  },
  drawerHint: {
    margin: "-6px 0 16px",
    color: "#7d89a3",
    fontSize: 12,
    lineHeight: 1.45,
  },
  inspectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 18,
  },
  inspectorTitle: {
    margin: "6px 0 0",
    fontSize: 18,
    lineHeight: 1.2,
    color: "#f4f6fa",
  },
  iconRow: { display: "inline-flex", gap: 8 },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 7,
    border: "1px solid #2b3448",
    background: "#161b27",
    color: "#d8dfed",
    cursor: "pointer",
    fontSize: 16,
  },
  form: { display: "grid", gap: 14 },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  field: {
    display: "grid",
    gap: 7,
    fontSize: 12,
    fontWeight: 700,
    color: "#9aa7bd",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 6,
    border: "1px solid #2b3448",
    background: "#0a0d14",
    color: "#e6ebf5",
    padding: "9px 10px",
    font: `13px ${baseFont}`,
    outline: "none",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 6,
    border: "1px solid #2b3448",
    background: "#0a0d14",
    color: "#e6ebf5",
    padding: "9px 10px",
    font: `13px/1.4 ${baseFont}`,
    resize: "vertical",
    outline: "none",
  },
  colorInput: {
    width: "100%",
    height: 38,
    borderRadius: 6,
    border: "1px solid #2b3448",
    background: "#0a0d14",
    padding: 4,
  },
  toggleRow: { display: "flex", gap: 14 },
  checkLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    color: "#d8dfed",
    fontSize: 13,
    fontWeight: 700,
  },
  addGrid: {
    marginTop: 20,
    paddingTop: 18,
    borderTop: "1px solid #20283a",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
  },
  secondaryButton: {
    height: 34,
    borderRadius: 7,
    border: "1px solid #2b3448",
    background: "#161b27",
    color: "#d8dfed",
    fontWeight: 700,
    cursor: "pointer",
  },
  segmented: {
    display: "inline-flex",
    padding: 3,
    borderRadius: 8,
    border: "1px solid #2b3448",
    background: "#10141e",
  },
  segment: {
    height: 28,
    padding: "0 10px",
    borderRadius: 6,
    border: "none",
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  },
  hiddenStages: {
    position: "fixed",
    left: -10000,
    top: 0,
    width: EXPORT_W,
    height: EXPORT_H,
    overflow: "hidden",
    pointerEvents: "none",
  },
} satisfies Record<string, CSSProperties>;
