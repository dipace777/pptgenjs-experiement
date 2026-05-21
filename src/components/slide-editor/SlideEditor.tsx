import { useHotkey } from "@tanstack/react-hotkeys";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { useCallback, useEffect, useRef } from "react";
import { SLIDE_H, SLIDE_W, type Deck } from "../../lib/slide-schema";
import { messiDeck } from "../../slide/spec";
import { KonvaSlide } from "./canvas/KonvaSlide";
import { styles } from "./editorStyles";
import {
  EXPORT_H,
  EXPORT_W,
  kindLabel,
  truncateWords,
  withHash,
  withoutHash,
} from "./editorUtils";
import { useDeckExport, useStageSize } from "./hooks";
import {
  BulletsInlineEditor,
  BulletsToolbar,
  ImageToolbar,
  ShapeToolbar,
  TableInlineEditor,
  TableToolbar,
  TextInlineEditor,
  TextToolbar,
} from "./inline";
import { ChartGridInspector } from "./inspector/ChartGridInspector";
import { Segmented } from "./shared/Segmented";
import {
  activeSlideAtom,
  activeSlideIndexAtom,
  addElementAtom,
  deckAtom,
  deleteSelectedAtom,
  duplicateSelectedAtom,
  editingBulletsDraftAtom,
  editingBulletsIndexAtom,
  editingTableDraftAtom,
  editingTableElementAtom,
  editingTableIndexAtom,
  editingTextIndexAtom,
  drawerElementAtom,
  editingBulletsElementAtom,
  editingTextElementAtom,
  editorOpenAtom,
  exportModeAtom,
  isExportingAtom,
  patchSelectedAtom,
  redoAtom,
  selectElementAtom,
  selectElementsAtom,
  selectedBulletsElementAtom,
  selectedIndexAtom,
  selectedImageElementAtom,
  selectedItemsAtom,
  selectedShapeElementAtom,
  selectedTableCellAtom,
  selectedTableElementAtom,
  selectedTextElementAtom,
  setSelectionAtom,
  undoAtom,
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
  const selectedTextElement = useAtomValue(selectedTextElementAtom);
  const selectedBulletsElement = useAtomValue(selectedBulletsElementAtom);
  const selectedImageElement = useAtomValue(selectedImageElementAtom);
  const selectedShapeElement = useAtomValue(selectedShapeElementAtom);
  const selectedTableElement = useAtomValue(selectedTableElementAtom);
  const [selectedTableCell, setSelectedTableCell] = useAtom(selectedTableCellAtom);
  const drawerElement = useAtomValue(drawerElementAtom);
  const editingTextElement = useAtomValue(editingTextElementAtom);
  const editingBulletsElement = useAtomValue(editingBulletsElementAtom);
  const editingTableElement = useAtomValue(editingTableElementAtom);
  const [editorOpen, setEditorOpen] = useAtom(editorOpenAtom);
  const [exportMode, setExportMode] = useAtom(exportModeAtom);
  const [editingTextIndex, setEditingTextIndex] = useAtom(editingTextIndexAtom);
  const [editingBulletsIndex, setEditingBulletsIndex] = useAtom(
    editingBulletsIndexAtom,
  );
  const [editingBulletsDraft, setEditingBulletsDraft] = useAtom(
    editingBulletsDraftAtom,
  );
  const [editingTableIndex, setEditingTableIndex] = useAtom(editingTableIndexAtom);
  const [editingTableDraft, setEditingTableDraft] = useAtom(editingTableDraftAtom);
  const isExporting = useAtomValue(isExportingAtom);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadTargetRef = useRef<number | null>(null);

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
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);

  useHotkey("Mod+Z", (event) => {
    event.preventDefault();
    undo();
  });
  useHotkey("Mod+Shift+Z", (event) => {
    event.preventDefault();
    redo();
  });
  useHotkey("Mod+Y", (event) => {
    event.preventDefault();
    redo();
  });

  const { stageWidth, stageWrapRef } = useStageSize();
  const { exportStageRefs, exportingType, handleExport, handlePdfExport } = useDeckExport();
  const stageScale = stageWidth / SLIDE_W;

  const openImageUpload = useCallback((index: number) => {
    imageUploadTargetRef.current = index;
    imageUploadInputRef.current?.click();
  }, []);

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
                setSelection(-1);
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
              <input
                ref={imageUploadInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                style={styles.inlineHiddenInput}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  const targetIndex = imageUploadTargetRef.current;
                  imageUploadTargetRef.current = null;
                  if (!file || targetIndex == null) {
                    event.target.value = "";
                    return;
                  }
                  const target = activeSlide.elements[targetIndex];
                  if (target?.kind !== "image") {
                    event.target.value = "";
                    return;
                  }
                  const reader = new FileReader();
                  reader.addEventListener("load", () => {
                    if (typeof reader.result !== "string") return;
                    updateElement({
                      index: targetIndex,
                      element: { ...target, data: reader.result, name: file.name },
                    });
                  });
                  reader.readAsDataURL(file);
                  event.target.value = "";
                }}
              />
              {selectedTextElement ? (
                <TextToolbar
                  element={selectedTextElement}
                  index={selectedIndex}
                  scale={stageScale}
                  onChange={(index, element) => updateElement({ index, element })}
                />
              ) : null}
              {selectedBulletsElement ? (
                <BulletsToolbar
                  element={selectedBulletsElement}
                  index={selectedIndex}
                  scale={stageScale}
                  onChange={(index, element) => updateElement({ index, element })}
                />
              ) : null}
              {selectedImageElement ? (
                <ImageToolbar
                  element={selectedImageElement}
                  index={selectedIndex}
                  scale={stageScale}
                  onChange={(index, element) => updateElement({ index, element })}
                  onUpload={openImageUpload}
                />
              ) : null}
              {selectedShapeElement ? (
                <ShapeToolbar
                  element={selectedShapeElement}
                  index={selectedIndex}
                  scale={stageScale}
                  onChange={(index, element) => updateElement({ index, element })}
                />
              ) : null}
              {selectedTableElement ? (
                <TableToolbar
                  element={selectedTableElement}
                  index={selectedIndex}
                  scale={stageScale}
                  selectedCell={
                    selectedTableCell?.elementIndex === selectedIndex
                      ? selectedTableCell
                      : null
                  }
                  onChange={(index, element) => updateElement({ index, element })}
                />
              ) : null}
              {editingTextElement && editingTextIndex != null ? (
                <TextInlineEditor
                  element={editingTextElement}
                  index={editingTextIndex}
                  scale={stageScale}
                  onChange={(index, element) => updateElement({ index, element })}
                  onClose={() => setEditingTextIndex(null)}
                />
              ) : null}
              {editingBulletsElement && editingBulletsIndex != null ? (
                <BulletsInlineEditor
                  element={editingBulletsElement}
                  index={editingBulletsIndex}
                  scale={stageScale}
                  draft={editingBulletsDraft}
                  onDraftChange={setEditingBulletsDraft}
                  onChange={(index, element) => updateElement({ index, element })}
                  onClose={() => {
                    setEditingBulletsIndex(null);
                    setEditingBulletsDraft("");
                  }}
                />
              ) : null}
              {editingTableElement && editingTableIndex != null ? (
                <TableInlineEditor
                  element={editingTableElement}
                  index={editingTableIndex}
                  scale={stageScale}
                  draft={editingTableDraft}
                  onDraftChange={setEditingTableDraft}
                  onChange={(index, element) => updateElement({ index, element })}
                  onClose={() => {
                    setEditingTableIndex(null);
                    setEditingTableDraft("");
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
                onSelectTableCell={(index, rowIndex, colIndex) => {
                  setSelectedTableCell({ elementIndex: index, rowIndex, colIndex });
                }}
                onDelete={deleteSelected}
                onEditText={(index) => {
                  setEditingBulletsIndex(null);
                  setEditingTableIndex(null);
                  setEditingTextIndex(index);
                }}
                onEditBullets={(index) => {
                  const element = activeSlide.elements[index];
                  setEditingBulletsDraft(
                    element?.kind === "bullets" ? element.items.join("\n") : "",
                  );
                  setEditingTableIndex(null);
                  setEditingTextIndex(null);
                  setEditingBulletsIndex(index);
                }}
                onEditImage={openImageUpload}
                onEditTable={(index) => {
                  const element = activeSlide.elements[index];
                  setEditingTableDraft(
                    element?.kind === "table"
                      ? element.rows.map((row) => row.join(", ")).join("\n")
                      : "",
                  );
                  setEditingTextIndex(null);
                  setEditingBulletsIndex(null);
                  setEditingTableIndex(index);
                }}
                editingTextIndex={editingTextIndex}
                editingBulletsIndex={editingBulletsIndex}
                editingTableIndex={editingTableIndex}
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
              <ChartGridInspector
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
