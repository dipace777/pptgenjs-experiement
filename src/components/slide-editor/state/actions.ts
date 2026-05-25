import { atom } from "jotai";
import {
  applyDeckTheme,
  resolveDeckTheme,
  type DeckTheme,
} from "../../../lib/deck-theme";
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
  selectedTableCellAtom,
} from "./atoms";
import { arrangeRepeatableComponents, getComponentRun } from "./componentGroups";
import { createDefaultElement } from "./createDefaultElement";
import { pushHistoryAtom } from "./history";

let componentInstanceCounter = 0;

// --- Selection actions --------------------------------------------------

export const selectElementAtom = atom(
  null,
  (get, set, payload: { index: number; additive?: boolean }) => {
    const { index, additive = false } = payload;
    if (index < 0) {
      set(selectedAtom, -1);
      set(selectedItemsAtom, []);
      set(selectedTableCellAtom, null);
      return;
    }
    if (!additive) {
      set(selectedAtom, index);
      set(selectedItemsAtom, [index]);
      const cell = get(selectedTableCellAtom);
      if (cell?.elementIndex !== index) set(selectedTableCellAtom, null);
      return;
    }
    const current = get(selectedItemsAtom);
    const next = current.includes(index)
      ? current.filter((item) => item !== index)
      : [...current, index];
    set(selectedItemsAtom, next);
    set(selectedAtom, next.at(-1) ?? -1);
    const cell = get(selectedTableCellAtom);
    if (cell && !next.includes(cell.elementIndex)) set(selectedTableCellAtom, null);
  },
);

export const setSelectionAtom = atom(null, (get, set, next: number) => {
  set(selectedAtom, next);
  set(selectedItemsAtom, next < 0 ? [] : [next]);
  const cell = get(selectedTableCellAtom);
  if (cell?.elementIndex !== next) set(selectedTableCellAtom, null);
});

export const selectElementsAtom = atom(null, (get, set, indexes: number[]) => {
  set(selectedItemsAtom, indexes);
  set(selectedAtom, indexes.at(-1) ?? -1);
  const cell = get(selectedTableCellAtom);
  if (cell && !indexes.includes(cell.elementIndex)) set(selectedTableCellAtom, null);
});

// --- Deck mutation actions ---------------------------------------------

export const updateDeckTitleAtom = atom(null, (_get, set, title: string) => {
  set(pushHistoryAtom, { tag: "updateDeckTitle" });
  set(deckAtom, (draft) => {
    draft.title = title;
  });
});

export const updateDeckThemeColorAtom = atom(
  null,
  (_get, set, payload: { key: keyof DeckTheme; value: string }) => {
    set(pushHistoryAtom, { tag: `updateDeckTheme:${payload.key}` });
    set(deckAtom, (draft) => {
      applyDeckTheme(draft, {
        ...resolveDeckTheme(draft),
        [payload.key]: payload.value,
      });
    });
  },
);

export const applyDeckThemePresetAtom = atom(
  null,
  (_get, set, payload: { id: string; theme: DeckTheme }) => {
    set(pushHistoryAtom, { tag: `applyDeckThemePreset:${payload.id}` });
    set(deckAtom, (draft) => {
      applyDeckTheme(draft, { ...payload.theme });
    });
  },
);

// Draft-mutator signature: callers receive the active slide's draft and
// mutate it in place.
export const updateActiveSlideAtom = atom(
  null,
  (get, set, mutate: (slide: Slide) => void) => {
    const activeIdx = get(activeSlideIndexAtom);
    set(pushHistoryAtom, { tag: `updateActiveSlide:${activeIdx}` });
    set(deckAtom, (draft) => {
      mutate(draft.slides[activeIdx]);
    });
  },
);

export const updateElementAtom = atom(
  null,
  (get, set, payload: { index: number; element: SlideElement }) => {
    const activeIdx = get(activeSlideIndexAtom);
    set(pushHistoryAtom, { tag: `updateElement:${activeIdx}:${payload.index}` });
    set(deckAtom, (draft) => {
      draft.slides[activeIdx].elements[payload.index] = payload.element;
    });
  },
);

export const updateElementsAtom = atom(
  null,
  (get, set, updates: Array<{ index: number; element: SlideElement }>) => {
    const activeIdx = get(activeSlideIndexAtom);
    set(pushHistoryAtom, { tag: `updateElements:${activeIdx}` });
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
    set(pushHistoryAtom, { tag: `patchSelected:${activeIdx}:${idx}` });
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
    set(pushHistoryAtom);
    set(deckAtom, (draft) => {
      draft.slides[activeIdx].elements.push(next);
    });
    set(selectedAtom, newIndex);
    set(selectedItemsAtom, [newIndex]);
    set(selectedTableCellAtom, null);
    set(editorOpenAtom, true);
  },
);

export const insertElementAtom = atom(
  null,
  (get, set, element: SlideElement) => {
    const slide = get(activeSlideAtom);
    if (!slide) return;
    const newIndex = slide.elements.length;
    const activeIdx = get(activeSlideIndexAtom);
    set(pushHistoryAtom);
    set(deckAtom, (draft) => {
      draft.slides[activeIdx].elements.push(element);
    });
    set(selectedAtom, newIndex);
    set(selectedItemsAtom, [newIndex]);
    set(selectedTableCellAtom, null);
    set(editorOpenAtom, true);
  },
);

export const insertElementsAtom = atom(
  null,
  (get, set, elements: SlideElement[]) => {
    const slide = get(activeSlideAtom);
    if (!slide || elements.length === 0) return;
    const activeIdx = get(activeSlideIndexAtom);
    const startIndex = slide.elements.length;
    const copies = elements.map(cloneElement);
    assignFreshComponentInstance(copies);
    set(pushHistoryAtom);
    set(deckAtom, (draft) => {
      const active = draft.slides[activeIdx];
      active.elements.push(...copies);
      const componentId = copies[0]?.componentId;
      if (componentId) arrangeRepeatableComponents(active, componentId);
    });
    const indexes = copies.map((_, offset) => startIndex + offset);
    set(selectedAtom, indexes.at(-1) ?? -1);
    set(selectedItemsAtom, indexes);
    set(selectedTableCellAtom, null);
    set(editorOpenAtom, true);
  },
);

export const duplicateSelectedAtom = atom(null, (get, set) => {
  const idx = get(selectedIndexAtom);
  const selected = get(activeSlideAtom)?.elements[idx];
  if (!selected) return;
  const copy = cloneElement(selected);
  delete copy.componentId;
  delete copy.componentInstanceId;
  delete copy.componentDescription;
  Object.assign(copy, {
    x: clamp(selected.x + 0.2, 0, SLIDE_W - selected.w),
    y: clamp(selected.y + 0.2, 0, SLIDE_H - selected.h),
  });
  const activeIdx = get(activeSlideIndexAtom);
  set(pushHistoryAtom);
  set(deckAtom, (draft) => {
    draft.slides[activeIdx].elements.splice(idx + 1, 0, copy);
  });
  set(selectedAtom, idx + 1);
  set(selectedItemsAtom, [idx + 1]);
  set(selectedTableCellAtom, null);
});

export const deleteSelectedAtom = atom(null, (get, set) => {
  const slide = get(activeSlideAtom);
  const selectedItems = get(selectedItemsAtom);
  const selected = selectedItems.length > 0 ? selectedItems : [get(selectedIndexAtom)];
  const indexes = [...new Set(selected)]
    .filter((index) => index >= 0 && index < (slide?.elements.length ?? 0))
    .sort((a, b) => b - a);
  if (!slide || indexes.length === 0) return;
  const activeIdx = get(activeSlideIndexAtom);
  const affectedComponentIds = [
    ...new Set(
      indexes.flatMap((index) => {
        const componentId = slide.elements[index]?.componentId;
        return componentId ? [componentId] : [];
      }),
    ),
  ];
  set(pushHistoryAtom);
  set(deckAtom, (draft) => {
    const active = draft.slides[activeIdx];
    for (const index of indexes) {
      active.elements.splice(index, 1);
    }
    for (const componentId of affectedComponentIds) {
      arrangeRepeatableComponents(active, componentId);
    }
  });
  const remainingCount = slide.elements.length - indexes.length;
  if (remainingCount <= 0) {
    set(selectedAtom, -1);
    set(selectedItemsAtom, []);
    set(selectedTableCellAtom, null);
    return;
  }
  const nextSelected = Math.min(Math.max(0, indexes.at(-1) ?? 0), remainingCount - 1);
  set(selectedAtom, nextSelected);
  set(selectedItemsAtom, [nextSelected]);
  set(selectedTableCellAtom, null);
});

export const deleteSelectedComponentRunAtom = atom(null, (get, set) => {
  const slide = get(activeSlideAtom);
  const idx = get(selectedIndexAtom);
  if (!slide || idx < 0) return;

  const run = getComponentRun(slide.elements, idx);
  if (!run) return;

  const activeIdx = get(activeSlideIndexAtom);
  set(pushHistoryAtom);
  set(deckAtom, (draft) => {
    const active = draft.slides[activeIdx];
    active.elements.splice(run.start, run.end - run.start + 1);
    arrangeRepeatableComponents(active, run.componentId);
  });

  const nextCount = slide.elements.length - run.indexes.length;
  if (nextCount <= 0) {
    set(selectedAtom, -1);
    set(selectedItemsAtom, []);
    set(selectedTableCellAtom, null);
    return;
  }

  const nextIndex = Math.min(run.start, nextCount - 1);
  set(selectedAtom, nextIndex);
  set(selectedItemsAtom, [nextIndex]);
  set(selectedTableCellAtom, null);
});

function cloneElement(element: SlideElement): SlideElement {
  return JSON.parse(JSON.stringify(element)) as SlideElement;
}

function assignFreshComponentInstance(elements: SlideElement[]) {
  const componentId = elements[0]?.componentId;
  if (!componentId) return;
  const instanceId = `${componentId}:${Date.now().toString(36)}:${componentInstanceCounter++}`;
  for (const element of elements) {
    if (element.componentId === componentId) {
      element.componentInstanceId = instanceId;
    }
  }
}
