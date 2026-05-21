import { useState } from "react";
import type { Slide } from "../../../lib/slide-schema";

export function useSelection(activeSlide: Slide | undefined) {
  const [selected, setSelected] = useState(0);
  const [selectedItems, setSelectedItems] = useState<number[]>([0]);

  const selectedIndex =
    selected >= 0
      ? Math.min(selected, Math.max(0, (activeSlide?.elements.length ?? 1) - 1))
      : -1;
  const selectedElement =
    selectedIndex >= 0 ? (activeSlide?.elements[selectedIndex] ?? null) : null;

  const selectElement = (index: number, additive = false) => {
    if (index < 0) {
      setSelected(-1);
      setSelectedItems([]);
      return;
    }

    if (!additive) {
      setSelected(index);
      setSelectedItems([index]);
      return;
    }

    setSelectedItems((current) => {
      const next = current.includes(index)
        ? current.filter((item) => item !== index)
        : [...current, index];
      setSelected(next.at(-1) ?? -1);
      return next;
    });
  };

  const setSelection = (next: number) => {
    setSelected(next);
    setSelectedItems(next < 0 ? [] : [next]);
  };

  return {
    selected,
    setSelected,
    selectedItems,
    setSelectedItems,
    selectedIndex,
    selectedElement,
    selectElement,
    setSelection,
  };
}

export type Selection = ReturnType<typeof useSelection>;
