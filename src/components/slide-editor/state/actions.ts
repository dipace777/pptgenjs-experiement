import { atom } from "jotai";
import {
  SLIDE_H,
  SLIDE_W,
  type Slide,
  type SlideElement,
} from "../../../lib/slide-schema";
import { clamp } from "../editorUtils";
import {
  activeSlideAtom,
  activeSlideIndexAtom,
  deckAtom,
  editorOpenAtom,
  selectedAtom,
  selectedIndexAtom,
  selectedItemsAtom,
} from "./atoms";
import { createDefaultElement } from "./createDefaultElement";

// --- Selection actions --------------------------------------------------

export const selectElementAtom = atom(
  null,
  (get, set, payload: { index: number; additive?: boolean }) => {
    const { index, additive = false } = payload;
    if (index < 0) {
      set(selectedAtom, -1);
      set(selectedItemsAtom, []);
      return;
    }
    if (!additive) {
      set(selectedAtom, index);
      set(selectedItemsAtom, [index]);
      return;
    }
    const current = get(selectedItemsAtom);
    const next = current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index];
    set(selectedItemsAtom, next);
    set(selectedAtom, next.at(-1) ?? -1);
  },
);

export const setSelectionAtom = atom(null, (_get, set, next: number) => {
  set(selectedAtom, next);
  set(selectedItemsAtom, next < 0 ? [] : [next]);
});

// --- Deck mutation actions ---------------------------------------------

export const updateActiveSlideAtom = atom(
  null,
  (get, set, updater: (slide: Slide) => Slide) => {
    const activeIdx = get(activeSlideIndexAtom);
    set(deckAtom, (current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === activeIdx ? updater(slide) : slide,
      ),
    }));
  },
);

export const updateElementAtom = atom(
  null,
  (_get, set, payload: { index: number; element: SlideElement }) => {
    set(updateActiveSlideAtom, (slide) => ({
      ...slide,
      elements: slide.elements.map((el, i) =>
        i === payload.index ? payload.element : el,
      ),
    }));
  },
);

export const updateElementsAtom = atom(
  null,
  (_get, set, updates: Array<{ index: number; element: SlideElement }>) => {
    set(updateActiveSlideAtom, (slide) => ({
      ...slide,
      elements: slide.elements.map((el, i) => {
        const update = updates.find((item) => item.index === i);
        return update ? update.element : el;
      }),
    }));
  },
);

// --- Element ops -------------------------------------------------------

export const patchSelectedAtom = atom(
  null,
  (get, set, patch: Partial<SlideElement>) => {
    const selectedIndex = get(selectedIndexAtom);
    const selectedElement = get(activeSlideAtom)?.elements[selectedIndex];
    if (!selectedElement) return;
    set(updateElementAtom, {
      index: selectedIndex,
      element: { ...selectedElement, ...patch } as SlideElement,
    });
  },
);

export const addElementAtom = atom(
  null,
  (get, set, kind: SlideElement["kind"]) => {
    const next = createDefaultElement(kind);
    const slide = get(activeSlideAtom);
    if (!slide) return;
    const newIndex = slide.elements.length;
    set(updateActiveSlideAtom, (current) => ({
      ...current,
      elements: [...current.elements, next],
    }));
    set(selectedAtom, newIndex);
    set(selectedItemsAtom, [newIndex]);
    set(editorOpenAtom, true);
  },
);

export const duplicateSelectedAtom = atom(null, (get, set) => {
  const idx = get(selectedIndexAtom);
  const selected = get(activeSlideAtom)?.elements[idx];
  if (!selected) return;
  const copy = {
    ...selected,
    x: clamp(selected.x + 0.2, 0, SLIDE_W - selected.w),
    y: clamp(selected.y + 0.2, 0, SLIDE_H - selected.h),
  } as SlideElement;
  set(updateActiveSlideAtom, (slide) => ({
    ...slide,
    elements: [
      ...slide.elements.slice(0, idx + 1),
      copy,
      ...slide.elements.slice(idx + 1),
    ],
  }));
  set(selectedAtom, idx + 1);
  set(selectedItemsAtom, [idx + 1]);
});

export const deleteSelectedAtom = atom(null, (get, set) => {
  const idx = get(selectedIndexAtom);
  const slide = get(activeSlideAtom);
  if (!slide || idx < 0 || slide.elements.length <= 1) return;
  set(updateActiveSlideAtom, (current) => ({
    ...current,
    elements: current.elements.filter((_, i) => i !== idx),
  }));
  const nextSelected = Math.max(0, idx - 1);
  set(selectedAtom, nextSelected);
  set(selectedItemsAtom, [nextSelected]);
});
