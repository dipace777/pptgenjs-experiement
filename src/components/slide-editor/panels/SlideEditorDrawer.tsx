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
import {
  elementBox,
  setTextContent,
  setTextListStrings,
  textContent,
  textListStrings,
} from "../../../lib/element-model";
import { prepareDesignElementsForInsertion } from "../../../lib/design-element-insertion";
import {
  editableDescendantsForSemanticElement,
  isSemanticElement,
  updateElementAtPath,
  type ElementPath,
} from "../../../lib/semantic-elements";
import type { SlideElement } from "../../../lib/slide-schema";
import type { ComponentTemplate } from "../componentTemplates";
import { styles } from "../editorStyles";
import { kindLabel, withHash, withoutHash } from "../editorUtils";
import { useSvgGeneration } from "../hooks";
import { ElementInspector } from "../inspector/ElementInspector";
import { ADDABLE_ELEMENT_KINDS } from "../registry";
import { EditorButton, TextareaField, TextField } from "../shared/FormControls";
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
  const selectedComponentSlots = selectedComponentRun
    ? componentSlotsForRun(activeSlide.elements, selectedComponentRun.indexes)
    : [];
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
    insertElements(
      prepareDesignElementsForInsertion(component.elements, activeSlide.background),
    );
    setComponentPickerOpen(false);
  };

  const updateComponentSlot = (componentSlot: string, value: string) => {
    updateActiveSlide((slide) => {
      const run = getComponentRun(slide.elements, selectedIndex);
      if (!run) return;

      for (const index of run.indexes) {
        const element = slide.elements[index];
        if (!element) continue;

        if (element.componentSlot === componentSlot && isTextEditableElement(element)) {
          slide.elements[index] = updateTextEditableElement(element, value);
          continue;
        }

        if (!isSemanticElement(element)) continue;

        let nextRoot: SlideElement = element;
        const descendants = editableDescendantsForSemanticElement(element);
        for (const descendant of descendants) {
          if (
            descendant.element.componentSlot !== componentSlot ||
            !isTextEditableElement(descendant.element)
          ) {
            continue;
          }
          nextRoot = updateElementAtPath(nextRoot, descendant.path, (child) =>
            isTextEditableElement(child)
              ? updateTextEditableElement(child, value)
              : child,
          );
        }
        slide.elements[index] = nextRoot;
      }
    });
  };

  const updateComponentImageSlot = (
    componentSlot: string,
    fileName: string,
    data: string,
  ) => {
    updateActiveSlide((slide) => {
      const run = getComponentRun(slide.elements, selectedIndex);
      if (!run) return;

      for (const index of run.indexes) {
        const element = slide.elements[index];
        if (!element) continue;

        if (
          element.componentSlot === componentSlot &&
          isImageReplaceableElement(element)
        ) {
          slide.elements[index] = imageElementWithUpload(element, fileName, data);
          continue;
        }

        if (!isSemanticElement(element)) continue;

        let nextRoot: SlideElement = element;
        const descendants = editableDescendantsForSemanticElement(element);
        for (const descendant of descendants) {
          if (
            descendant.element.componentSlot !== componentSlot ||
            !isImageReplaceableElement(descendant.element)
          ) {
            continue;
          }
          nextRoot = updateElementAtPath(nextRoot, descendant.path, (child) =>
            isImageReplaceableElement(child)
              ? imageElementWithUpload(child, fileName, data)
              : child,
          );
        }
        slide.elements[index] = nextRoot;
      }
    });
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
          previewBackground={activeSlide.background}
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
            {selectedComponentSlots.length > 0 ? (
              <ComponentSlotFields
                slots={selectedComponentSlots}
                onChange={updateComponentSlot}
                onImageChange={updateComponentImageSlot}
              />
            ) : null}
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

type ComponentSlotMember = {
  element: SlideElement;
  index: number;
  path?: ElementPath;
};

type ComponentSlotField = {
  editor: "image" | "summary" | "text";
  key: string;
  label: string;
  rows: number;
  value: string;
};

function ComponentSlotFields({
  slots,
  onChange,
  onImageChange,
}: {
  slots: ComponentSlotField[];
  onChange: (componentSlot: string, value: string) => void;
  onImageChange: (componentSlot: string, fileName: string, data: string) => void;
}) {
  return (
    <div style={drawerStyles.componentSlotGrid}>
      {slots.map((slot) =>
        slot.editor === "text" ? (
          slot.rows <= 1 ? (
            <TextField
              key={slot.key}
              label={slot.label}
              value={slot.value}
              onChange={(value) => onChange(slot.key, value)}
            />
          ) : (
            <TextareaField
              key={slot.key}
              label={slot.label}
              value={slot.value}
              rows={slot.rows}
              onChange={(value) => onChange(slot.key, value)}
            />
          )
        ) : slot.editor === "image" ? (
          <ImageSlotField
            key={slot.key}
            slot={slot}
            onChange={onImageChange}
          />
        ) : (
          <div key={slot.key} style={styles.field}>
            <span>{slot.label}</span>
            <div style={drawerStyles.componentSlotSummary}>{slot.value}</div>
          </div>
        ),
      )}
    </div>
  );
}

function ImageSlotField({
  slot,
  onChange,
}: {
  slot: ComponentSlotField;
  onChange: (componentSlot: string, fileName: string, data: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") return;
      onChange(slot.key, file.name, reader.result);
    });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  return (
    <div style={styles.field}>
      <span>{slot.label}</span>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleChange}
        style={{ display: "none" }}
      />
      <div style={drawerStyles.componentImageSlotRow}>
        <div style={drawerStyles.componentSlotSummary}>{slot.value}</div>
        <EditorButton onClick={() => inputRef.current?.click()}>
          {slot.value ? "Replace" : "Upload"}
        </EditorButton>
      </div>
    </div>
  );
}

function componentSlotsForRun(
  elements: SlideElement[],
  indexes: number[],
): ComponentSlotField[] {
  const membersBySlot = new Map<string, ComponentSlotMember[]>();

  for (const index of indexes) {
    const element = elements[index];
    if (!element) continue;
    addSlotMember(membersBySlot, element.componentSlot, { element, index });

    if (!isSemanticElement(element)) continue;
    for (const descendant of editableDescendantsForSemanticElement(element)) {
      addSlotMember(membersBySlot, descendant.element.componentSlot, {
        element: descendant.element,
        index,
        path: descendant.path,
      });
    }
  }

  return [...membersBySlot.entries()]
    .map(([key, members]) => componentSlotField(key, members))
    .sort(
      (a, b) =>
        componentSlotSortOrder(a.key) - componentSlotSortOrder(b.key) ||
        a.label.localeCompare(b.label),
    );
}

function addSlotMember(
  membersBySlot: Map<string, ComponentSlotMember[]>,
  componentSlot: string | null | undefined,
  member: ComponentSlotMember,
) {
  if (!componentSlot) return;
  const members = membersBySlot.get(componentSlot);
  if (members) members.push(member);
  else membersBySlot.set(componentSlot, [member]);
}

function componentSlotField(
  key: string,
  members: ComponentSlotMember[],
): ComponentSlotField {
  const editableMembers = members.filter(isTextEditableMember);
  const imageMembers = members.filter(isImageReplaceableMember);
  const editor =
    editableMembers.length > 0
      ? "text"
      : imageMembers.length > 0
        ? "image"
        : "summary";
  const value =
    editor === "text"
      ? editableMembers.map((member) => textEditableValue(member.element)).join("\n")
      : members.map((member) => slotSummary(member.element)).filter(Boolean).join(" / ");

  return {
    editor,
    key,
    label: componentSlotLabel(key),
    rows: slotRows(key, value, editableMembers),
    value: value || slotSummary(members[0]?.element),
  };
}

function componentSlotLabel(componentSlot: string) {
  return componentSlot
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function componentSlotSortOrder(componentSlot: string) {
  const normalized = componentSlot.toLowerCase();
  const order = [
    "title",
    "subtitle",
    "metric",
    "date",
    "label",
    "body",
    "list",
    "image",
    "icon",
    "chart",
    "table",
    "accent",
    "shape",
  ];
  const index = order.findIndex((key) => normalized.includes(key));
  return index >= 0 ? index : order.length;
}

function slotRows(
  key: string,
  value: string,
  members: ComponentSlotMember[],
): number {
  if (key.includes("body") || key.includes("list")) return 3;
  if (members.some((member) => member.element.type === "text-list")) return 3;
  if (value.length > 72 || value.includes("\n")) return 3;
  return 1;
}

function isTextEditableElement(
  element: SlideElement,
): element is Extract<SlideElement, { type: "text" | "text-list" }> {
  return element.type === "text" || element.type === "text-list";
}

function isTextEditableMember(
  member: ComponentSlotMember,
): member is ComponentSlotMember & {
  element: Extract<SlideElement, { type: "text" | "text-list" }>;
} {
  return isTextEditableElement(member.element);
}

function isImageReplaceableElement(
  element: SlideElement,
): element is Extract<SlideElement, { type: "image" | "svg" }> {
  return element.type === "image" || element.type === "svg";
}

function isImageReplaceableMember(
  member: ComponentSlotMember,
): member is ComponentSlotMember & {
  element: Extract<SlideElement, { type: "image" | "svg" }>;
} {
  return isImageReplaceableElement(member.element);
}

function textEditableValue(
  element: Extract<SlideElement, { type: "text" | "text-list" }>,
) {
  if (element.type === "text") return textContent(element);
  return textListStrings(element).join("\n");
}

function updateTextEditableElement(
  element: Extract<SlideElement, { type: "text" | "text-list" }>,
  value: string,
): SlideElement {
  if (element.type === "text") return setTextContent(element, value);
  const items = value
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return setTextListStrings(element, items.length > 0 ? items : [" "]);
}

function imageElementWithUpload(
  element: Extract<SlideElement, { type: "image" | "svg" }>,
  fileName: string,
  data: string,
): SlideElement {
  if (element.type === "image") {
    return {
      ...element,
      data,
      name: fileName,
      fit: element.fit ?? "cover",
    };
  }

  return {
    type: "image",
    fixed: element.fixed,
    position: element.position,
    size: element.size,
    rotation: element.rotation,
    opacity: element.opacity,
    shadow: element.shadow,
    componentId: element.componentId,
    componentInstanceId: element.componentInstanceId,
    componentDescription: element.componentDescription,
    componentSlot: element.componentSlot,
    layout: element.layout,
    data,
    name: fileName,
    fit: "contain",
  };
}

function slotSummary(element: SlideElement | undefined): string {
  if (!element) return "";
  if (element.type === "chart") {
    return element.title ?? `${componentSlotLabel(element.chartType)} chart`;
  }
  if (element.type === "table") {
    return `${element.columns.length} columns, ${element.rows.length} rows`;
  }
  if (element.type === "image" || element.type === "svg") {
    return element.name ?? componentSlotLabel(element.type);
  }
  if (element.type === "line") return "Divider";
  return componentSlotLabel(element.type);
}

function ComponentPickerDrawer({
  components,
  onClose,
  onInsert,
  previewBackground,
}: {
  components: ReadonlyArray<ComponentTemplate>;
  onClose: () => void;
  onInsert: (component: ComponentTemplate) => void;
  previewBackground: string;
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
            <ComponentPreview
              elements={component.elements}
              preferredBackground={previewBackground}
            />
            <span style={drawerStyles.componentPreviewName}>{component.label}</span>
            <span style={drawerStyles.componentPreviewMeta}>
              {componentMeta(component)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ComponentPreview({
  elements,
  preferredBackground,
}: {
  elements: SlideElement[];
  preferredBackground: string;
}) {
  const bounds = useMemo(() => boundsForElements(elements), [elements]);
  const background = useMemo(
    () => previewBackgroundForElements(elements, preferredBackground),
    [elements, preferredBackground],
  );
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
                fill={withHash(background)}
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

function previewBackgroundForElements(
  elements: readonly SlideElement[],
  preferredBackground: string,
): string {
  const preferred = normalizePreviewHex(preferredBackground, "F8FAFC");
  const textColor = dominantTextColor(elements);
  if (!textColor || contrastRatio(textColor, preferred) >= 3) {
    return preferred;
  }
  return relativeLuminance(textColor) < 0.45 ? "F8FAFC" : "080B12";
}

function dominantTextColor(elements: readonly SlideElement[]): string | null {
  const colors = collectTextColors(elements)
    .map((color) => normalizePreviewHex(color, ""))
    .filter(Boolean);
  if (colors.length === 0) return null;

  const counts = new Map<string, number>();
  for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1);
  return (
    [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  );
}

function collectTextColors(elements: readonly SlideElement[]): string[] {
  const colors: string[] = [];
  for (const element of elements) collectElementTextColors(element, colors);
  return colors;
}

function collectElementTextColors(element: SlideElement, colors: string[]) {
  if (element.type === "text") {
    if (element.font?.color) colors.push(element.font.color);
    element.runs.forEach((run) => {
      if (run.font?.color) colors.push(run.font.color);
    });
    return;
  }

  if (element.type === "text-list") {
    if (element.font?.color) colors.push(element.font.color);
    return;
  }

  if (element.type === "table") {
    if (element.font?.color) colors.push(element.font.color);
    [...element.columns, ...element.rows.flat()].forEach((cell) => {
      if (cell.font?.color) colors.push(cell.font.color);
    });
    return;
  }

  if (element.type === "chart") {
    if (element.labelColor) colors.push(element.labelColor);
    return;
  }

  if (element.type === "container") {
    if (element.child) collectElementTextColors(element.child, colors);
    return;
  }

  if (
    element.type === "group" ||
    element.type === "flex" ||
    element.type === "grid"
  ) {
    element.children.forEach((child) => collectElementTextColors(child, colors));
    return;
  }

  if (element.type === "list-view" || element.type === "grid-view") {
    collectElementTextColors(element.item, colors);
  }
}

function normalizePreviewHex(color: string, fallback: string): string {
  const clean = color.trim().replace(/^#/, "").toUpperCase();
  if (/^[0-9A-F]{6}$/.test(clean)) return clean;
  return fallback;
}

function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);
  return (light + 0.05) / (dark + 0.05);
}

function relativeLuminance(hex: string): number {
  const clean = normalizePreviewHex(hex, "000000");
  const channels = [0, 2, 4].map((start) => {
    const value = Number.parseInt(clean.slice(start, start + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function componentLabel(componentId: string) {
  return componentId
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function componentMeta(component: ComponentTemplate) {
  const parts = [
    component.intent ? component.intent.replace(/-/g, " ") : null,
    component.slots?.length ? `${component.slots.length} slots` : null,
    component.qualityScore != null ? `${Math.round(component.qualityScore)} quality` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : `${component.elements.length} elements`;
}
