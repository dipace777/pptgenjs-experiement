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

// Draft-mutator signature: callers receive the active slide's draft and
// mutate it in place.
export const updateActiveSlideAtom = atom(
  null,
  (get, set, mutate: (slide: Slide) => void) => {
    const activeIdx = get(activeSlideIndexAtom);
    set(deckAtom, (draft) => {
      mutate(draft.slides[activeIdx]);
    });
  },
);

export const updateElementAtom = atom(
  null,
  (get, set, payload: { index: number; element: SlideElement }) => {
    const activeIdx = get(activeSlideIndexAtom);
    set(deckAtom, (draft) => {
      draft.slides[activeIdx].elements[payload.index] = payload.element;
    });
  },
);

export const updateElementsAtom = atom(
  null,
  (get, set, updates: Array<{ index: number; element: SlideElement }>) => {
    const activeIdx = get(activeSlideIndexAtom);
    set(deckAtom, (draft) => {
      const elements = draft.slides[activeIdx].elements;
      for (const { index, element } of updates) {
        elements[index] = element;
      }
    });
  },
);

// --- Element ops -------------------------------------------------------

export const patchSelectedAtom = atom(
  null,
  (get, set, patch: Partial<SlideElement>) => {
    const idx = get(selectedIndexAtom);
    const activeIdx = get(activeSlideIndexAtom);
    if (idx < 0) return;
    set(deckAtom, (draft) => {
      const target = draft.slides[activeIdx].elements[idx];
      if (!target) return;
      Object.assign(target, patch);
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
    const activeIdx = get(activeSlideIndexAtom);
    set(deckAtom, (draft) => {
      draft.slides[activeIdx].elements.push(next);
    });
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
  const activeIdx = get(activeSlideIndexAtom);
  set(deckAtom, (draft) => {
    draft.slides[activeIdx].elements.splice(idx + 1, 0, copy);
  });
  set(selectedAtom, idx + 1);
  set(selectedItemsAtom, [idx + 1]);
});

export const deleteSelectedAtom = atom(null, (get, set) => {
  const idx = get(selectedIndexAtom);
  const slide = get(activeSlideAtom);
  if (!slide || idx < 0 || slide.elements.length <= 1) return;
  const activeIdx = get(activeSlideIndexAtom);
  set(deckAtom, (draft) => {
    draft.slides[activeIdx].elements.splice(idx, 1);
  });
  const nextSelected = Math.max(0, idx - 1);
  set(selectedAtom, nextSelected);
  set(selectedItemsAtom, [nextSelected]);
});
