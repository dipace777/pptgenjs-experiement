import { useRef, type ChangeEvent } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { styles } from "../editorStyles";
import { kindLabel, withHash, withoutHash } from "../editorUtils";
import { useSvgGeneration } from "../hooks";
import { ElementInspector } from "../inspector/ElementInspector";
import { ADDABLE_ELEMENT_KINDS } from "../registry";
import {
  activeSlideAtom,
  activeSlideIndexAtom,
  addElementAtom,
  duplicateSelectedAtom,
  patchSelectedAtom,
  selectedElementAtom,
  selectedIndexAtom,
  updateActiveSlideAtom,
  updateElementAtom,
} from "../state";
import { drawerStyles } from "./drawerStyles";

type SlideEditorDrawerProps = {
  onClose: () => void;
};

export function SlideEditorDrawer({ onClose }: SlideEditorDrawerProps) {
  const active = useAtomValue(activeSlideIndexAtom);
  const activeSlide = useAtomValue(activeSlideAtom);
  const selectedElement = useAtomValue(selectedElementAtom);
  const selectedIndex = useAtomValue(selectedIndexAtom);
  const updateActiveSlide = useSetAtom(updateActiveSlideAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const patchSelected = useSetAtom(patchSelectedAtom);
  const addElement = useSetAtom(addElementAtom);
  const duplicateSelected = useSetAtom(duplicateSelectedAtom);
  const {
    svgPrompt,
    setSvgPrompt,
    isGeneratingSvg,
    svgGenerationStatus,
    generatePromptSvg,
  } = useSvgGeneration();
  const backgroundImageInputRef = useRef<HTMLInputElement | null>(null);

  const handleBackgroundImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      updateActiveSlide((slide) => {
        slide.backgroundImage = {
          data: reader.result as string,
          fit: slide.backgroundImage?.fit ?? "cover",
          opacity: slide.backgroundImage?.opacity ?? null,
        };
      });
    });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div
      aria-modal="true"
      role="dialog"
      style={drawerStyles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside style={drawerStyles.drawer}>
        <div style={drawerStyles.header}>
          <div>
            <div style={styles.eyebrow}>
              SLIDE {String(active + 1).padStart(2, "0")}
            </div>
            <h2 style={drawerStyles.title}>
              {selectedElement ? kindLabel(selectedElement.kind) : "Slide"}
            </h2>
          </div>
          <div style={drawerStyles.iconRow}>
            {selectedElement ? (
              <button
                type="button"
                title="Duplicate"
                onClick={() => duplicateSelected()}
                style={drawerStyles.iconButton}
              >
                ⧉
              </button>
            ) : null}
            <button
              type="button"
              title="Close editor"
              onClick={onClose}
              style={drawerStyles.iconButton}
            >
              ×
            </button>
          </div>
        </div>

        <div style={drawerStyles.hint}>
          {selectedElement
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

        <div style={styles.field}>
          <span>Background image</span>
          <input
            ref={backgroundImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleBackgroundImageChange}
            style={{ display: "none" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: activeSlide.backgroundImage ? "1fr 1fr" : "1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => backgroundImageInputRef.current?.click()}
              style={styles.secondaryButton}
            >
              {activeSlide.backgroundImage ? "Replace" : "Upload"}
            </button>
            {activeSlide.backgroundImage ? (
              <button
                type="button"
                onClick={() =>
                  updateActiveSlide((slide) => {
                    slide.backgroundImage = null;
                  })
                }
                style={styles.secondaryButton}
              >
                Remove
              </button>
            ) : null}
          </div>
          {activeSlide.backgroundImage ? (
            <select
              value={activeSlide.backgroundImage.fit ?? "cover"}
              onChange={(event) =>
                updateActiveSlide((slide) => {
                  if (!slide.backgroundImage) return;
                  slide.backgroundImage.fit = event.target.value as
                    | "cover"
                    | "contain"
                    | "fill";
                })
              }
              style={styles.input}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="fill">Fill</option>
            </select>
          ) : null}
        </div>

        {selectedElement ? (
          <ElementInspector
            element={selectedElement}
            selectedIndex={selectedIndex}
            onPatch={patchSelected}
            onReplace={(index, element) => updateElement({ index, element })}
          />
        ) : null}

        <div style={drawerStyles.addGrid}>
          {ADDABLE_ELEMENT_KINDS.map((kind) => (
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

        <div style={drawerStyles.generatorPanel}>
          <label style={styles.field}>
            <span>Generate SVG from prompt</span>
            <textarea
              value={svgPrompt}
              onChange={(event) => setSvgPrompt(event.target.value)}
              rows={3}
              style={styles.textarea}
            />
          </label>
          <button
            type="button"
            onClick={generatePromptSvg}
            disabled={!svgPrompt.trim() || isGeneratingSvg}
            style={{
              ...styles.primaryButton,
              opacity: svgPrompt.trim() && !isGeneratingSvg ? 1 : 0.55,
              cursor:
                svgPrompt.trim() && !isGeneratingSvg ? "pointer" : "not-allowed",
            }}
          >
            {isGeneratingSvg ? "Generating..." : "Generate SVG"}
          </button>
          {svgGenerationStatus ? (
            <div style={drawerStyles.hint}>{svgGenerationStatus}</div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
