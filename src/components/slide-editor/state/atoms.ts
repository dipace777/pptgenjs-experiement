import { atom } from "jotai";
import { selectAtom } from "jotai/utils";
import type { Deck, Slide, SlideElement } from "../../../lib/slide-schema";
import { messiDeck } from "../../../slide/spec";

export type ExportMode = "native" | "raster";

// --- Primitive atoms ----------------------------------------------------

// Initial value is a placeholder; SlideEditor uses `useHydrateAtoms` to
// seed the real deck on mount so each editor instance starts fresh.
export const deckAtom = atom<Deck>(messiDeck);
export const activeSlideIndexAtom = atom(0);
export const selectedAtom = atom(0);
export const selectedItemsAtom = atom<number[]>([0]);
export const editorOpenAtom = atom(false);
export const exportModeAtom = atom<ExportMode>("native");
export const isExportingAtom = atom(false);

// --- Derived atoms ------------------------------------------------------

export const activeSlideAtom = atom<Slide>((get) => {
  const deck = get(deckAtom);
  const active = get(activeSlideIndexAtom);
  return deck.slides[active];
});

// Clamp selected index against the active slide's element count so the
// inspector never points at a stale element after a delete.
export const selectedIndexAtom = selectAtom(
  atom((get) => ({
    selected: get(selectedAtom),
    count: get(activeSlideAtom)?.elements.length ?? 0,
  })),
  ({ selected, count }) =>
    selected >= 0 ? Math.min(selected, Math.max(0, count - 1)) : -1,
);

export const selectedElementAtom = atom<SlideElement | null>((get) => {
  const idx = get(selectedIndexAtom);
  if (idx < 0) return null;
  return get(activeSlideAtom)?.elements[idx] ?? null;
});
