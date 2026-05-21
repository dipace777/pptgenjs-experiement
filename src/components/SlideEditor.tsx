import Konva from "konva";
import PptxGenJS from "pptxgenjs";
import { useEffect, useRef, useState } from "react";
import { SLIDE_H, SLIDE_W, type Deck, type Slide, type SlideElement } from "../lib/slide-schema";
import { generatePptx } from "../slide/generatePptx";
import { messiDeck } from "../slide/spec";
import { Inspector } from "./Inspector";
import { KonvaSlide } from "./KonvaSlide";
import { Segmented } from "./Segmented";
import { styles } from "./editorStyles";
import {
  EXPORT_H,
  EXPORT_W,
  STAGE_W,
  clamp,
  filenameFromTitle,
  kindLabel,
  withHash,
  withoutHash,
} from "./editorUtils";

export function SlideEditor() {
  const [deck, setDeck] = useState<Deck>(messiDeck);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState(0);
  const [selectedItems, setSelectedItems] = useState<number[]>([0]);
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

  const updateElements = (updates: Array<{ index: number; element: SlideElement }>) => {
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.map((el, i) => {
        const update = updates.find((item) => item.index === i);
        return update ? update.element : el;
      }),
    }));
  };

  const patchSelected = (patch: Partial<SlideElement>) => {
    if (!selectedElement) return;
    updateElement(selectedIndex, { ...selectedElement, ...patch } as SlideElement);
  };

  const selectElement = (index: number, additive = false) => {
    if (index < 0) {
      setSelected(-1);
      setSelectedItems([]);
      return;
    }

    if (!additive) {
      setSelected(index);
      setSelectedItems([index]);
      return;
    }

    setSelectedItems((current) => {
      const next = current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index];
      setSelected(next.at(-1) ?? -1);
      return next;
    });
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
          : kind === "table"
            ? {
                ...base,
                w: 5.2,
                h: 2.1,
                kind,
                rows: [
                  ["Metric", "Apps", "Goals"],
                  ["La Liga", "520", "474"],
                  ["Champions League", "163", "129"],
                  ["Argentina", "190+", "110+"],
                ],
                fontFace: "Arial",
                fontSize: 11,
                textColor: "1A2B45",
                headerFill: "0B1F3A",
                headerTextColor: "FFFFFF",
                borderColor: "DDE5F0",
                fill: "FFFFFF",
              }
          : kind === "grid"
            ? {
                ...base,
                w: 5.2,
                h: 2.2,
                kind,
                columns: 3,
                items: Array.from({ length: 9 }, (_, index) => ({
                  type: "text" as const,
                  title: String(index + 1).padStart(2, "0"),
                  subtitle: "Placeholder",
                })),
                fontFace: "Arial",
                numberFontSize: 24,
                labelFontSize: 7,
                numberColor: "3E78B2",
                labelColor: "6A7894",
                fill: "FFFFFF",
                borderColor: "DDE5F0",
                gap: 0.14,
                rx: 0.08,
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
      setSelectedItems([slide.elements.length]);
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
      setSelectedItems([selectedIndex + 1]);
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
    setSelected((index) => {
      const next = Math.max(0, index - 1);
      setSelectedItems([next]);
      return next;
    });
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
                setSelectedItems([0]);
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
                selectedItems={selectedItems}
                onSelect={selectElement}
                onChange={updateElement}
                onChangeMany={updateElements}
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

            <label style={styles.field}>
              <span>Slide background</span>
              <input
                type="color"
                value={withHash(activeSlide.background)}
                onChange={(event) =>
                  updateActiveSlide((slide) => ({
                    ...slide,
                    background: withoutHash(event.target.value),
                  }))
                }
                style={styles.colorInput}
              />
            </label>

            {selectedElement ? (
              <Inspector
                element={selectedElement}
                onPatch={patchSelected}
                onReplace={(next) => updateElement(selectedIndex, next)}
              />
            ) : null}

            <div style={styles.addGrid}>
              {(["text", "rect", "ellipse", "bullets", "chart", "table", "grid"] as const).map((kind) => (
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
