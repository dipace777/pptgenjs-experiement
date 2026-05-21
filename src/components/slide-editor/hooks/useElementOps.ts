import { SLIDE_H, SLIDE_W, type SlideElement } from "../../../lib/slide-schema";
import { clamp } from "../editorUtils";
import { createDefaultElement } from "./createDefaultElement";
import type { DeckState } from "./useDeckState";
import type { Selection } from "./useSelection";

export function useElementOps({
  deckState,
  selection,
  onAdded,
}: {
  deckState: DeckState;
  selection: Selection;
  onAdded?: () => void;
}) {
  const { activeSlide, updateActiveSlide, updateElement } = deckState;
  const {
    selectedElement,
    selectedIndex,
    setSelected,
    setSelectedItems,
  } = selection;

  const patchSelected = (patch: Partial<SlideElement>) => {
    if (!selectedElement) return;
    updateElement(selectedIndex, { ...selectedElement, ...patch } as SlideElement);
  };

  const addElement = (kind: SlideElement["kind"]) => {
    const next = createDefaultElement(kind);
    updateActiveSlide((slide) => {
      setSelected(slide.elements.length);
      setSelectedItems([slide.elements.length]);
      onAdded?.();
      return { ...slide, elements: [...slide.elements, next] };
    });
  };

  const duplicateSelected = () => {
    if (!selectedElement) return;
    const copy = {
      ...selectedElement,
      x: clamp(selectedElement.x + 0.2, 0, SLIDE_W - selectedElement.w),
      y: clamp(selectedElement.y + 0.2, 0, SLIDE_H - selectedElement.h),
    } as SlideElement;
    updateActiveSlide((slide) => {
      setSelected(selectedIndex + 1);
      setSelectedItems([selectedIndex + 1]);
      return {
        ...slide,
        elements: [
          ...slide.elements.slice(0, selectedIndex + 1),
          copy,
          ...slide.elements.slice(selectedIndex + 1),
        ],
      };
    });
  };

  const deleteSelected = () => {
    if (!selectedElement || activeSlide.elements.length <= 1) return;
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.filter((_, index) => index !== selectedIndex),
    }));
    setSelected((index) => {
      const next = Math.max(0, index - 1);
      setSelectedItems([next]);
      return next;
    });
  };

  return { patchSelected, addElement, duplicateSelected, deleteSelected };
}
