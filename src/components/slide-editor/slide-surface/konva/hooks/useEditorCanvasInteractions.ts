import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { Slide, SlideElement } from "../../../../../lib/slide-schema";
import {
  deleteSelectedAtom,
  editingBulletsDraftAtom,
  editingBulletsIndexAtom,
  editingTableDraftAtom,
  editingTableIndexAtom,
  editingTextIndexAtom,
  selectElementAtom,
  selectElementsAtom,
  selectedIndexAtom,
  selectedItemsAtom,
  selectedTableCellAtom,
  updateElementAtom,
  updateElementsAtom,
} from "../../../state";

export function useEditorCanvasInteractions({
  onEditImage,
  slide,
}: {
  onEditImage?: (index: number) => void;
  slide: Slide;
}) {
  const selected = useAtomValue(selectedIndexAtom);
  const selectedItems = useAtomValue(selectedItemsAtom);
  const editingTextIndex = useAtomValue(editingTextIndexAtom);
  const editingBulletsIndex = useAtomValue(editingBulletsIndexAtom);
  const editingTableIndex = useAtomValue(editingTableIndexAtom);
  const selectElement = useSetAtom(selectElementAtom);
  const selectElements = useSetAtom(selectElementsAtom);
  const setSelectedTableCell = useSetAtom(selectedTableCellAtom);
  const deleteSelected = useSetAtom(deleteSelectedAtom);
  const setEditingTextIndex = useSetAtom(editingTextIndexAtom);
  const setEditingBulletsIndex = useSetAtom(editingBulletsIndexAtom);
  const setEditingBulletsDraft = useSetAtom(editingBulletsDraftAtom);
  const setEditingTableIndex = useSetAtom(editingTableIndexAtom);
  const setEditingTableDraft = useSetAtom(editingTableDraftAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);

  const editText = useCallback(
    (index: number) => {
      setEditingBulletsIndex(null);
      setEditingTableIndex(null);
      setEditingTextIndex(index);
    },
    [setEditingBulletsIndex, setEditingTableIndex, setEditingTextIndex],
  );

  const editBullets = useCallback(
    (index: number) => {
      const element = slide.elements[index];
      setEditingBulletsDraft(
        element?.kind === "bullets" ? element.items.join("\n") : "",
      );
      setEditingTableIndex(null);
      setEditingTextIndex(null);
      setEditingBulletsIndex(index);
    },
    [
      setEditingBulletsDraft,
      setEditingBulletsIndex,
      setEditingTableIndex,
      setEditingTextIndex,
      slide.elements,
    ],
  );

  const editTable = useCallback(
    (index: number) => {
      const element = slide.elements[index];
      setEditingTableDraft(
        element?.kind === "table"
          ? element.rows.map((row) => row.join(", ")).join("\n")
          : "",
      );
      setEditingTextIndex(null);
      setEditingBulletsIndex(null);
      setEditingTableIndex(index);
    },
    [
      setEditingBulletsIndex,
      setEditingTableDraft,
      setEditingTableIndex,
      setEditingTextIndex,
      slide.elements,
    ],
  );

  return {
    editingBulletsIndex,
    editingTableIndex,
    editingTextIndex,
    onChange: (index: number, element: SlideElement) =>
      updateElement({ index, element }),
    onChangeMany: updateElements,
    onDelete: deleteSelected,
    onEditBullets: editBullets,
    onEditImage,
    onEditTable: editTable,
    onEditText: editText,
    onSelect: (index: number, additive?: boolean) =>
      selectElement({ index, additive }),
    onSelectMany: selectElements,
    onSelectTableCell: (index: number, rowIndex: number, colIndex: number) => {
      setSelectedTableCell({ elementIndex: index, rowIndex, colIndex });
    },
    selected,
    selectedItems,
  };
}
