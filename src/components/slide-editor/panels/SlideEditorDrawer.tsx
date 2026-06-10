import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Group, Layer, Rect, Stage } from "react-konva";
import { elementBox, resizeElement } from "../../../lib/element-model";
import { isSemanticElement } from "../../../lib/semantic-elements";
import { SLIDE_H, SLIDE_W, type SlideElement } from "../../../lib/slide-schema";
import type { ComponentTemplate } from "../componentTemplates";
import { styles } from "../editorStyles";
import { kindLabel, withHash, withoutHash } from "../editorUtils";
import { useSvgGeneration } from "../hooks";
import { ElementInspector } from "../inspector/ElementInspector";
import { ADDABLE_ELEMENT_KINDS } from "../registry";
import { EditorButton, TextareaField } from "../shared/FormControls";
import { renderKonvaElement } from "../slide-surface/konva/elementRenderers";
import type { ElementEvents } from "../slide-surface/konva/types";
import {
  activeSlideAtom,
  activeSlideIndexAtom,
  addElementAtom,
  deleteSelectedComponentRunAtom,
  duplicateSelectedAtom,
  enterGroupEditAtom,
  exitGroupEditAtom,
  getComponentRun,
  groupEditRootIndexAtom,
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
  const groupEditRootIndex = useAtomValue(groupEditRootIndexAtom);
  const selectedComponentRun = getComponentRun(activeSlide.elements, selectedIndex);
  const updateActiveSlide = useSetAtom(updateActiveSlideAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const patchSelected = useSetAtom(patchSelectedAtom);
  const addElement = useSetAtom(addElementAtom);
  const insertElements = useSetAtom(insertElementsAtom);
  const duplicateSelected = useSetAtom(duplicateSelectedAtom);
  const deleteSelectedComponentRun = useSetAtom(deleteSelectedComponentRunAtom);
  const enterGroupEdit = useSetAtom(enterGroupEditAtom);
  const exitGroupEdit = useSetAtom(exitGroupEditAtom);
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
    insertElements(centerElementsForInsertion(component.elements));
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
              {selectedElement ? kindLabel(selectedElement.type) : "Slide"}
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

        {selectedElement && isSemanticElement(selectedElement) && selectedIndex >= 0 ? (
          <div style={drawerStyles.componentPanel}>
            <div style={drawerStyles.sectionTitle}>
              {groupEditRootIndex === selectedIndex ? "Editing contents" : "Group contents"}
            </div>
            <div style={drawerStyles.componentMeta}>
              {groupEditRootIndex === selectedIndex
                ? "Select or double-click a child element inside this group."
                : "Enter the group to edit its nested text and objects."}
            </div>
            <EditorButton
              onClick={() =>
                groupEditRootIndex === selectedIndex
                  ? exitGroupEdit()
                  : enterGroupEdit(selectedIndex)
              }
            >
              {groupEditRootIndex === selectedIndex ? "Done editing contents" : "Edit contents"}
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
  const stageRef = useRef<HTMLSpanElement | null>(null);
  const previewSize = useMeasuredPreviewSize(stageRef);
  const scale = previewScale(bounds, previewSize);
  const contentW = bounds.w * scale;
  const contentH = bounds.h * scale;
  const offsetX = (previewSize.width - contentW) / 2 - bounds.x * scale;
  const offsetY = (previewSize.height - contentH) / 2 - bounds.y * scale;

  return (
    <span style={drawerStyles.componentPreviewFrame}>
      <span ref={stageRef} style={drawerStyles.componentPreviewStage}>
        {previewSize.width > 0 && previewSize.height > 0 ? (
          <Stage
            width={previewSize.width}
            height={previewSize.height}
            style={{ display: "block", pointerEvents: "none" }}
          >
            <Layer listening={false}>
              <Rect
                width={previewSize.width}
                height={previewSize.height}
                fill="#080b12"
              />
              <Group x={offsetX} y={offsetY}>
                {elements.map((element, index) => (
                  <Group key={`${element.type}-${index}`}>
                    {renderKonvaElement({
                      element,
                      index,
                      scale,
                      selected: false,
                      setRef: noopRef,
                      events: previewEvents,
                      bulletsRenderMode: "canvas",
                      chartRenderMode: "canvas",
                      tableRenderMode: "canvas",
                      textRenderMode: "canvas",
                    })}
                  </Group>
                ))}
              </Group>
            </Layer>
          </Stage>
        ) : null}
      </span>
    </span>
  );
}

const PREVIEW_PADDING = 8;

const previewEvents: ElementEvents = {
  draggable: false,
  onClick: () => false,
  onDblClick: () => undefined,
  onTap: () => false,
  onMouseDown: () => undefined,
  onMouseMove: () => undefined,
  onMouseUp: () => undefined,
  onMouseLeave: () => undefined,
  onTouchStart: () => undefined,
  onTouchMove: () => undefined,
  onTouchEnd: () => undefined,
  onTouchCancel: () => undefined,
  onDragStart: () => undefined,
  onDragMove: () => undefined,
  onDragEnd: () => undefined,
  onTransformEnd: () => undefined,
};

function noopRef() {
  return undefined;
}

function useMeasuredPreviewSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const measure = () => {
      const rect = node.getBoundingClientRect();
      setSize({
        width: Math.max(1, Math.round(rect.width)),
        height: Math.max(1, Math.round(rect.height)),
      });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}

type PreviewBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

function boundsForElements(elements: SlideElement[]): PreviewBounds {
  if (elements.length === 0) return { x: 0, y: 0, w: 1, h: 1 };
  const boxes = elements.map(elementBox);
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));
  return {
    x: minX,
    y: minY,
    w: Math.max(0.01, maxX - minX),
    h: Math.max(0.01, maxY - minY),
  };
}

function previewScale(
  bounds: PreviewBounds,
  size: { width: number; height: number },
): number {
  const availableW = Math.max(1, size.width - PREVIEW_PADDING * 2);
  const availableH = Math.max(1, size.height - PREVIEW_PADDING * 2);
  return Math.max(
    0.01,
    Math.min(availableW / bounds.w, availableH / bounds.h),
  );
}

function centerElementsForInsertion(elements: readonly SlideElement[]): SlideElement[] {
  const copies = elements.map(cloneElement);
  if (copies.length === 0) return [];
  const bounds = boundsForElements(copies);
  const targetX = Math.max(0, (SLIDE_W - bounds.w) / 2);
  const targetY = Math.max(0, (SLIDE_H - bounds.h) / 2);
  const dx = targetX - bounds.x;
  const dy = targetY - bounds.y;
  return copies.map((element) => {
    const box = elementBox(element);
    return resizeElement(element, {
      x: box.x + dx,
      y: box.y + dy,
    });
  });
}

function cloneElement(element: SlideElement): SlideElement {
  return JSON.parse(JSON.stringify(element)) as SlideElement;
}

function componentLabel(componentId: string) {
  return componentId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
