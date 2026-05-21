import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { useEffect, useMemo, useState } from "react";
import { SLIDE_H, SLIDE_W, type Deck } from "../../lib/slide-schema";
import { messiDeck } from "../../slide/spec";
import { KonvaSlide } from "./canvas/KonvaSlide";
import { styles } from "./editorStyles";
import {
  EXPORT_H,
  EXPORT_W,
  PT_TO_PX,
  PX_PER_IN,
  kindLabel,
  truncateWords,
  withHash,
  withoutHash,
} from "./editorUtils";
import { useDeckExport, useStageSize } from "./hooks";
import { Inspector } from "./inspector/Inspector";
import { Segmented } from "./shared/Segmented";
import {
  activeSlideAtom,
  activeSlideIndexAtom,
  addElementAtom,
  deckAtom,
  deleteSelectedAtom,
  duplicateSelectedAtom,
  editorOpenAtom,
  exportModeAtom,
  isExportingAtom,
  patchSelectedAtom,
  selectElementAtom,
  selectElementsAtom,
  selectedElementAtom,
  selectedIndexAtom,
  selectedItemsAtom,
  setSelectionAtom,
  updateActiveSlideAtom,
  updateElementAtom,
  updateElementsAtom,
} from "./state";

export function SlideEditor({ initialDeck = messiDeck }: { initialDeck?: Deck }) {
  return (
    <Provider>
      <SlideEditorBody initialDeck={initialDeck} />
    </Provider>
  );
}

function SlideEditorBody({ initialDeck }: { initialDeck: Deck }) {
  useHydrateAtoms([[deckAtom, initialDeck]]);

  const [deck, setDeck] = useAtom(deckAtom);
  const [active, setActive] = useAtom(activeSlideIndexAtom);
  const activeSlide = useAtomValue(activeSlideAtom);
  const selectedIndex = useAtomValue(selectedIndexAtom);
  const selectedItems = useAtomValue(selectedItemsAtom);
  const selectedElement = useAtomValue(selectedElementAtom);
  const [editorOpen, setEditorOpen] = useAtom(editorOpenAtom);
  const [exportMode, setExportMode] = useAtom(exportModeAtom);
  const isExporting = useAtomValue(isExportingAtom);
  const [editingTextIndex, setEditingTextIndex] = useState<number | null>(null);

  const selectElement = useSetAtom(selectElementAtom);
  const selectElements = useSetAtom(selectElementsAtom);
  const setSelection = useSetAtom(setSelectionAtom);
  const updateActiveSlide = useSetAtom(updateActiveSlideAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);
  const patchSelected = useSetAtom(patchSelectedAtom);
  const addElement = useSetAtom(addElementAtom);
  const duplicateSelected = useSetAtom(duplicateSelectedAtom);
  const deleteSelected = useSetAtom(deleteSelectedAtom);

  const { stageWidth, stageWrapRef } = useStageSize();
  const { exportStageRefs, exportingType, handleExport, handlePdfExport } = useDeckExport();
  const stageScale = stageWidth / SLIDE_W;
  const selectedTextElement =
    selectedElement?.kind === "text" ? selectedElement : null;
  const drawerElement =
    selectedElement?.kind === "text" ? null : selectedElement;
  const editingTextElement = useMemo(() => {
    if (editingTextIndex == null) return null;
    const element = activeSlide.elements[editingTextIndex];
    return element?.kind === "text" ? element : null;
  }, [activeSlide.elements, editingTextIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (selectedItems.length === 0 && selectedIndex < 0) return;
      event.preventDefault();
      deleteSelected();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelected, selectedIndex, selectedItems.length]);

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.header}>
          <div style={styles.eyebrow}>INTERNAL JSON</div>
          <input
            aria-label="Deck title"
            value={deck.title}
            onChange={(event) =>
              setDeck((draft) => {
                draft.title = event.target.value;
              })
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
              {deck.description
                ? truncateWords(deck.description, 15)
                : "React + Konva live preview; JSON remains the source of truth."}
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
              {exportingType === "pptx" ? "Exporting PPTX..." : "Export PPTX"}
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={handlePdfExport}
              style={styles.secondaryButton}
            >
              {exportingType === "pdf" ? "Exporting PDF..." : "Export PDF"}
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
              {selectedTextElement ? (
                <div
                  style={{
                    ...styles.inlineTextToolbar,
                    left: Math.max(8, selectedTextElement.x * stageScale),
                    top: Math.max(8, selectedTextElement.y * stageScale - 48),
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    title="Bold"
                    aria-pressed={selectedTextElement.bold ?? false}
                    onClick={() =>
                      updateElement({
                        index: selectedIndex,
                        element: {
                          ...selectedTextElement,
                          bold: !(selectedTextElement.bold ?? false),
                        },
                      })
                    }
                    style={{
                      ...styles.inlineTextButton,
                      ...(selectedTextElement.bold ? styles.inlineTextButtonActive : {}),
                    }}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    title="Italic"
                    aria-pressed={selectedTextElement.italic ?? false}
                    onClick={() =>
                      updateElement({
                        index: selectedIndex,
                        element: {
                          ...selectedTextElement,
                          italic: !(selectedTextElement.italic ?? false),
                        },
                      })
                    }
                    style={{
                      ...styles.inlineTextButton,
                      fontStyle: "italic",
                      ...(selectedTextElement.italic ? styles.inlineTextButtonActive : {}),
                    }}
                  >
                    I
                  </button>
                  <input
                    aria-label="Font size"
                    title="Font size"
                    type="number"
                    min={6}
                    max={360}
                    value={selectedTextElement.fontSize}
                    onChange={(event) =>
                      updateElement({
                        index: selectedIndex,
                        element: {
                          ...selectedTextElement,
                          fontSize: Number(event.target.value) || selectedTextElement.fontSize,
                        },
                      })
                    }
                    style={styles.inlineFontSize}
                  />
                  <input
                    aria-label="Text color"
                    title="Text color"
                    type="color"
                    value={withHash(selectedTextElement.color)}
                    onChange={(event) =>
                      updateElement({
                        index: selectedIndex,
                        element: {
                          ...selectedTextElement,
                          color: withoutHash(event.target.value),
                        },
                      })
                    }
                    style={styles.inlineColor}
                  />
                  <input
                    aria-label="Text opacity"
                    title="Text opacity"
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={selectedTextElement.opacity ?? 1}
                    onChange={(event) =>
                      updateElement({
                        index: selectedIndex,
                        element: {
                          ...selectedTextElement,
                          opacity: Number(event.target.value),
                        },
                      })
                    }
                    style={styles.inlineOpacity}
                  />
                </div>
              ) : null}
              {editingTextElement && editingTextIndex != null ? (
                <textarea
                  autoFocus
                  value={editingTextElement.text}
                  onChange={(event) =>
                    updateElement({
                      index: editingTextIndex,
                      element: { ...editingTextElement, text: event.target.value || " " },
                    })
                  }
                  onBlur={() => setEditingTextIndex(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.currentTarget.blur();
                    }
                  }}
                  style={{
                    ...styles.inlineTextEditor,
                    left: editingTextElement.x * stageScale,
                    top: editingTextElement.y * stageScale,
                    width: editingTextElement.w * stageScale,
                    height: editingTextElement.h * stageScale,
                    color: withHash(editingTextElement.color),
                    fontFamily: `${editingTextElement.fontFace ?? "Arial"}, Helvetica, sans-serif`,
                    fontSize:
                      editingTextElement.fontSize * PT_TO_PX * (stageScale / PX_PER_IN),
                    fontWeight: editingTextElement.bold ? 700 : 400,
                    fontStyle: editingTextElement.italic ? "italic" : "normal",
                    textAlign: editingTextElement.align ?? "left",
                    lineHeight: editingTextElement.lineHeight ?? 1.15,
                    letterSpacing:
                      ((editingTextElement.charSpacing ?? 0) / 100) *
                      PT_TO_PX *
                      (stageScale / PX_PER_IN),
                  }}
                />
              ) : null}
              <KonvaSlide
                slide={activeSlide}
                width={stageWidth}
                height={stageWidth * (SLIDE_H / SLIDE_W)}
                interactive
                selected={selectedIndex}
                selectedItems={selectedItems}
                onSelect={(index, additive) =>
                  selectElement({ index, additive })
                }
                onSelectMany={selectElements}
                onDelete={deleteSelected}
                onEditText={setEditingTextIndex}
                editingTextIndex={editingTextIndex}
                onChange={(index, element) => updateElement({ index, element })}
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
                  {drawerElement ? kindLabel(drawerElement.kind) : "Slide"}
                </h2>
              </div>
              <div style={styles.iconRow}>
                {drawerElement ? (
                  <button
                    type="button"
                    title="Duplicate"
                    onClick={() => duplicateSelected()}
                    style={styles.iconButton}
                  >
                    ⧉
                  </button>
                ) : null}
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
              {drawerElement
                ? "Select an object on the slide, then adjust it here."
                : "Adjust slide-level settings or add new elements."}
            </div>

            <label style={styles.field}>
              <span>Slide background</span>
              <input
                type="color"
                value={withHash(activeSlide.background)}
                onChange={(event) =>
                  updateActiveSlide((slide) => {
                    slide.background = withoutHash(event.target.value);
                  })
                }
                style={styles.colorInput}
              />
            </label>

            {drawerElement ? (
              <Inspector
                element={drawerElement}
                onPatch={patchSelected}
                onReplace={(next) =>
                  updateElement({ index: selectedIndex, element: next })
                }
              />
            ) : null}

            <div style={styles.addGrid}>
              {(["text", "rect", "ellipse", "bullets", "chart", "table", "grid", "image"] as const).map((kind) => (
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
