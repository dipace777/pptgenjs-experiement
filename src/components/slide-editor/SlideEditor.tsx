import { useState } from "react";
import { SLIDE_H, SLIDE_W, type Deck } from "../../lib/slide-schema";
import { messiDeck } from "../../slide/spec";
import { KonvaSlide } from "./canvas/KonvaSlide";
import { styles } from "./editorStyles";
import { EXPORT_H, EXPORT_W, kindLabel, withHash, withoutHash } from "./editorUtils";
import {
  useDeckExport,
  useDeckState,
  useElementOps,
  useSelection,
  useStageSize,
} from "./hooks";
import { Inspector } from "./inspector/Inspector";
import { Segmented } from "./shared/Segmented";

export function SlideEditor({ initialDeck = messiDeck }: { initialDeck?: Deck }) {
  const [editorOpen, setEditorOpen] = useState(false);

  const deckState = useDeckState(initialDeck);
  const selection = useSelection(deckState.activeSlide);
  const ops = useElementOps({
    deckState,
    selection,
    onAdded: () => setEditorOpen(true),
  });
  const exporter = useDeckExport(deckState.deck);
  const { stageWidth, stageWrapRef } = useStageSize();

  const {
    deck,
    setDeck,
    active,
    setActive,
    activeSlide,
    updateActiveSlide,
    updateElement,
    updateElements,
  } = deckState;
  const { selectedIndex, selectedItems, selectedElement, selectElement, setSelection } =
    selection;

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
                setSelection(0);
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
              value={exporter.exportMode}
              options={[
                ["native", "Native"],
                ["raster", "Raster"],
              ]}
              onChange={(value) => exporter.setExportMode(value)}
            />
            <button
              type="button"
              disabled={exporter.isExporting}
              onClick={exporter.handleExport}
              style={styles.primaryButton}
            >
              {exporter.isExporting ? "Exporting..." : "Export PPTX"}
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
                  onClick={ops.duplicateSelected}
                  style={styles.iconButton}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={ops.deleteSelected}
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
                onPatch={ops.patchSelected}
                onReplace={(next) => updateElement(selectedIndex, next)}
              />
            ) : null}

            <div style={styles.addGrid}>
              {(["text", "rect", "ellipse", "bullets", "chart", "table", "grid", "image"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => ops.addElement(kind)}
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
              exporter.exportStageRefs.current[index] = node;
            }}
          />
        ))}
      </div>
    </div>
  );
}
