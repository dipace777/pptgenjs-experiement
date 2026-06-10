import { useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import type { SlideElement } from "../../../lib/slide-schema";
import type { ComponentTemplate } from "../componentTemplates";
import { styles } from "../editorStyles";
import { kindLabel, withHash, withoutHash } from "../editorUtils";
import { useSvgGeneration } from "../hooks";
import { ElementInspector } from "../inspector/ElementInspector";
import { ADDABLE_ELEMENT_KINDS } from "../registry";
import { EditorButton, TextareaField } from "../shared/FormControls";
import {
  activeSlideAtom,
  activeSlideIndexAtom,
  addElementAtom,
  deleteSelectedComponentRunAtom,
  duplicateSelectedAtom,
  getComponentRun,
  insertElementsAtom,
  patchSelectedAtom,
  selectedElementAtom,
  selectedIndexAtom,
  updateActiveSlideAtom,
  updateElementAtom,
} from "../state";
import { drawerStyles } from "./drawerStyles";

type SlideEditorDrawerProps = {
  componentTemplates?: ReadonlyArray<ComponentTemplate>;
  onClose: () => void;
};

export function SlideEditorDrawer({
  componentTemplates = [],
  onClose,
}: SlideEditorDrawerProps) {
  const [componentPickerOpen, setComponentPickerOpen] = useState(false);
  const active = useAtomValue(activeSlideIndexAtom);
  const activeSlide = useAtomValue(activeSlideAtom);
  const selectedElement = useAtomValue(selectedElementAtom);
  const selectedIndex = useAtomValue(selectedIndexAtom);
  const selectedComponentRun = getComponentRun(activeSlide.elements, selectedIndex);
  const updateActiveSlide = useSetAtom(updateActiveSlideAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const patchSelected = useSetAtom(patchSelectedAtom);
  const addElement = useSetAtom(addElementAtom);
  const insertElements = useSetAtom(insertElementsAtom);
  const duplicateSelected = useSetAtom(duplicateSelectedAtom);
  const deleteSelectedComponentRun = useSetAtom(deleteSelectedComponentRunAtom);
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

  const insertComponent = (component: ComponentTemplate) => {
    insertElements(component.elements);
    setComponentPickerOpen(false);
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
      {componentPickerOpen && componentTemplates.length > 0 ? (
        <ComponentPickerDrawer
          components={componentTemplates}
          onClose={() => setComponentPickerOpen(false)}
          onInsert={insertComponent}
        />
      ) : null}
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

        {selectedComponentRun ? (
          <div style={drawerStyles.componentPanel}>
            <div style={drawerStyles.sectionTitle}>
              {componentLabel(selectedComponentRun.componentId)}
            </div>
            <div style={drawerStyles.componentMeta}>
              {selectedComponentRun.indexes.length} editable elements selected as one component.
            </div>
            <EditorButton onClick={() => deleteSelectedComponentRun()}>
              Delete component
            </EditorButton>
          </div>
        ) : null}

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
            <EditorButton onClick={() => backgroundImageInputRef.current?.click()}>
              {activeSlide.backgroundImage ? "Replace" : "Upload"}
            </EditorButton>
            {activeSlide.backgroundImage ? (
              <EditorButton
                onClick={() =>
                  updateActiveSlide((slide) => {
                    slide.backgroundImage = null;
                  })
                }
              >
                Remove
              </EditorButton>
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
            <EditorButton
              key={kind}
              onClick={() => addElement(kind)}
            >
              + {kindLabel(kind)}
            </EditorButton>
          ))}
          {componentTemplates.length > 0 ? (
            <EditorButton
              onClick={() => setComponentPickerOpen(true)}
            >
              + Design Element
            </EditorButton>
          ) : null}
        </div>

        {componentTemplates.length > 0 ? (
          <div style={drawerStyles.componentHint}>
            {componentTemplates.length} reusable design elements available.
          </div>
        ) : null}

        <div style={drawerStyles.generatorPanel}>
          <TextareaField
            label="Generate SVG from prompt"
            value={svgPrompt}
            rows={3}
            onChange={setSvgPrompt}
          />
          <EditorButton
            variant="primary"
            onClick={generatePromptSvg}
            disabled={!svgPrompt.trim() || isGeneratingSvg}
          >
            {isGeneratingSvg ? "Generating..." : "Generate SVG"}
          </EditorButton>
          {svgGenerationStatus ? (
            <div style={drawerStyles.hint}>{svgGenerationStatus}</div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function ComponentPickerDrawer({
  components,
  onClose,
  onInsert,
}: {
  components: ReadonlyArray<ComponentTemplate>;
  onClose: () => void;
  onInsert: (component: ComponentTemplate) => void;
}) {
  return (
    <aside style={drawerStyles.componentDrawer}>
      <div style={drawerStyles.header}>
        <div>
          <div style={styles.eyebrow}>ADD DESIGN ELEMENT</div>
          <h2 style={drawerStyles.title}>Design Elements</h2>
        </div>
        <button
          type="button"
          title="Close components"
          onClick={onClose}
          style={drawerStyles.iconButton}
        >
          ×
        </button>
      </div>

      <div style={drawerStyles.hint}>
        Reusable blocks extracted from this deck.
      </div>

      <div style={drawerStyles.componentPreviewGrid}>
        {components.map((component) => (
          <button
            key={component.id}
            type="button"
            title={component.description ?? component.label}
            onClick={() => onInsert(component)}
            style={drawerStyles.componentPreviewCard}
          >
            <ComponentPreview elements={component.elements} />
            <span style={drawerStyles.componentPreviewName}>{component.label}</span>
            <span style={drawerStyles.componentPreviewMeta}>
              {component.elements.length} elements
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ComponentPreview({ elements }: { elements: SlideElement[] }) {
  const bounds = useMemo(() => boundsForElements(elements), [elements]);
  return (
    <span style={drawerStyles.componentPreviewFrame}>
      <span style={drawerStyles.componentPreviewStage}>
        {elements.map((element, index) => (
          <span
            key={index}
            style={{
              ...previewElementStyle(element, bounds),
              zIndex: index + 1,
            }}
          />
        ))}
      </span>
    </span>
  );
}

type PreviewBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function boundsForElements(elements: SlideElement[]): PreviewBounds {
  if (elements.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const minX = Math.min(...elements.map((element) => element.x));
  const minY = Math.min(...elements.map((element) => element.y));
  const maxX = Math.max(...elements.map((element) => element.x + element.w));
  const maxY = Math.max(...elements.map((element) => element.y + element.h));
  return {
    x: minX,
    y: minY,
    w: Math.max(0.01, maxX - minX),
    h: Math.max(0.01, maxY - minY),
  };
}

function previewElementStyle(
  element: SlideElement,
  bounds: PreviewBounds,
): CSSProperties {
  const left = ((element.x - bounds.x) / bounds.w) * 100;
  const top = ((element.y - bounds.y) / bounds.h) * 100;
  const width = (element.w / bounds.w) * 100;
  const height = (element.h / bounds.h) * 100;
  const style: CSSProperties = {
    position: "absolute",
    left: `${left}%`,
    top: `${top}%`,
    width: `${width}%`,
    height: `${height}%`,
    boxSizing: "border-box",
    opacity: element.opacity ?? 1,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "center",
  };

  if (element.kind === "text" || element.kind === "bullets") {
    return {
      ...style,
      borderRadius: 2,
      background: withHash(element.kind === "text" ? element.color : element.color),
      opacity: 0.75,
    };
  }

  if (element.kind === "rect" || element.kind === "ellipse") {
    return {
      ...style,
      borderRadius: element.kind === "ellipse" ? "999px" : 3,
      background: withHash(element.fill),
      border: element.line ? `1px solid ${withHash(element.line.color)}` : undefined,
      boxShadow: element.shadow
        ? `0 2px 8px rgba(0,0,0,${Math.min(0.35, element.shadow.opacity + 0.12)})`
        : undefined,
    };
  }

  if (element.kind === "image") {
    return {
      ...style,
      borderRadius: 4,
      background: element.data
        ? `linear-gradient(135deg, #26334a, #111827)`
        : "#20283a",
      border: "1px dashed rgba(216,223,237,0.3)",
    };
  }

  if (element.kind === "table") {
    return {
      ...style,
      borderRadius: 3,
      background: withHash(element.fill ?? "FFFFFF"),
      border: `1px solid ${withHash(element.borderColor)}`,
      backgroundImage: `linear-gradient(${withHash(element.headerFill)} 0 28%, transparent 28%)`,
    };
  }

  if (element.kind === "chart") {
    return {
      ...style,
      borderRadius: 4,
      background: `linear-gradient(135deg, ${withHash(element.color)}, #20283a)`,
    };
  }

  return {
    ...style,
    borderRadius: 4,
    background: "#6a7894",
  };
}

function componentLabel(componentId: string) {
  return componentId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
