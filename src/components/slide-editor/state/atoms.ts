import { atom } from "jotai";
import { selectAtom } from "jotai/utils";
import { atomWithImmer } from "jotai-immer";
import type { Slide, SlideElement } from "../../../lib/slide-schema";
import { layoutKitDeck } from "../../../templates/layout-kit";

export type ExportMode = "native" | "keynote" | "raster";
export type TextSlideElement = Extract<SlideElement, { kind: "text" }>;
export type BulletsSlideElement = Extract<SlideElement, { kind: "bullets" }>;
export type ImageSlideElement = Extract<SlideElement, { kind: "image" }>;
export type ShapeSlideElement = Extract<SlideElement, { kind: "rect" | "ellipse" }>;
export type TableSlideElement = Extract<SlideElement, { kind: "table" }>;
export type ChartSlideElement = Extract<SlideElement, { kind: "chart" }>;
export type TableCellSelection = { elementIndex: number; rowIndex: number; colIndex: number };

// --- Primitive atoms ----------------------------------------------------

// Immer-backed: writers receive a draft of the Deck they can mutate
// directly. SlideEditor seeds the real deck via `useHydrateAtoms`.
export const deckAtom = atomWithImmer(layoutKitDeck);
export const activeSlideIndexAtom = atom(0);
export const selectedAtom = atom(-1);
export const selectedItemsAtom = atom<number[]>([]);
export const editorOpenAtom = atom(false);
export const presentingAtom = atom(false);
export const exportModeAtom = atom<ExportMode>("native");
export const isExportingAtom = atom(false);
export const editingTextIndexAtom = atom<number | null>(null);
export const editingBulletsIndexAtom = atom<number | null>(null);
export const editingBulletsDraftAtom = atom("");
export const editingTableIndexAtom = atom<number | null>(null);
export const editingTableDraftAtom = atom("");
export const selectedTableCellAtom = atom<TableCellSelection | null>(null);

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

export const selectedTextElementAtom = atom<TextSlideElement | null>((get) => {
  const element = get(selectedElementAtom);
  return element?.kind === "text" ? element : null;
});

export const selectedBulletsElementAtom = atom<BulletsSlideElement | null>((get) => {
  const element = get(selectedElementAtom);
  return element?.kind === "bullets" ? element : null;
});

export const selectedImageElementAtom = atom<ImageSlideElement | null>((get) => {
  const element = get(selectedElementAtom);
  return element?.kind === "image" ? element : null;
});

export const selectedShapeElementAtom = atom<ShapeSlideElement | null>((get) => {
  const element = get(selectedElementAtom);
  return element?.kind === "rect" || element?.kind === "ellipse" ? element : null;
});

export const selectedTableElementAtom = atom<TableSlideElement | null>((get) => {
  const element = get(selectedElementAtom);
  return element?.kind === "table" ? element : null;
});

export const selectedChartElementAtom = atom<ChartSlideElement | null>((get) => {
  const element = get(selectedElementAtom);
  return element?.kind === "chart" ? element : null;
});

export const editingTextElementAtom = atom<TextSlideElement | null>((get) => {
  const index = get(editingTextIndexAtom);
  if (index == null) return null;
  const element = get(activeSlideAtom).elements[index];
  return element?.kind === "text" ? element : null;
});

export const editingBulletsElementAtom = atom<BulletsSlideElement | null>((get) => {
  const index = get(editingBulletsIndexAtom);
  if (index == null) return null;
  const element = get(activeSlideAtom).elements[index];
  return element?.kind === "bullets" ? element : null;
});

export const editingTableElementAtom = atom<TableSlideElement | null>((get) => {
  const index = get(editingTableIndexAtom);
  if (index == null) return null;
  const element = get(activeSlideAtom).elements[index];
  return element?.kind === "table" ? element : null;
});
