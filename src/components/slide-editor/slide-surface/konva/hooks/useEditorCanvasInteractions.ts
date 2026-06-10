import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import type { Slide, SlideElement } from "../../../../../lib/slide-schema";
import { textListStrings } from "../../../../../lib/element-model";
import {
  deleteSelectedAtom,
  editNestedTextAtom,
  editingBulletsDraftAtom,
  editingBulletsIndexAtom,
  editingChartDraftAtom,
  editingChartIndexAtom,
  editingNestedTextAtom,
  editingSvgDraftAtom,
  editingSvgIndexAtom,
  editingTableDraftAtom,
  editingTableIndexAtom,
  editingTextIndexAtom,
  enterGroupEditAtom,
  groupEditRootIndexAtom,
  selectElementAtom,
  selectElementsAtom,
  selectNestedElementAtom,
  selectedIndexAtom,
  selectedItemsAtom,
  selectedNestedElementAtom,
  selectedTableCellAtom,
  updateElementAtom,
  updateElementsAtom,
  type NestedElementSelection,
} from "../../../state";
import {
  chartDraftFromElement,
  svgDraftFromElement,
  tableDraftFromElement,
} from "../../../inline";

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
  const editingChartIndex = useAtomValue(editingChartIndexAtom);
  const editingSvgIndex = useAtomValue(editingSvgIndexAtom);
  const editingNestedElement = useAtomValue(editingNestedTextAtom);
  const groupEditRootIndex = useAtomValue(groupEditRootIndexAtom);
  const selectedNestedElement = useAtomValue(selectedNestedElementAtom);
  const selectElement = useSetAtom(selectElementAtom);
  const selectElements = useSetAtom(selectElementsAtom);
  const selectNestedElement = useSetAtom(selectNestedElementAtom);
  const editNestedText = useSetAtom(editNestedTextAtom);
  const enterGroupEdit = useSetAtom(enterGroupEditAtom);
  const setSelectedTableCell = useSetAtom(selectedTableCellAtom);
  const deleteSelected = useSetAtom(deleteSelectedAtom);
  const setEditingTextIndex = useSetAtom(editingTextIndexAtom);
  const setEditingBulletsIndex = useSetAtom(editingBulletsIndexAtom);
  const setEditingBulletsDraft = useSetAtom(editingBulletsDraftAtom);
  const setEditingTableIndex = useSetAtom(editingTableIndexAtom);
  const setEditingTableDraft = useSetAtom(editingTableDraftAtom);
  const setEditingChartIndex = useSetAtom(editingChartIndexAtom);
  const setEditingChartDraft = useSetAtom(editingChartDraftAtom);
  const setEditingSvgIndex = useSetAtom(editingSvgIndexAtom);
  const setEditingSvgDraft = useSetAtom(editingSvgDraftAtom);
  const updateElement = useSetAtom(updateElementAtom);
  const updateElements = useSetAtom(updateElementsAtom);

  const editText = useCallback(
    (index: number) => {
      setEditingBulletsIndex(null);
      setEditingTableIndex(null);
      setEditingChartIndex(null);
      setEditingSvgIndex(null);
      setEditingTextIndex(index);
    },
    [
      setEditingBulletsIndex,
      setEditingChartIndex,
      setEditingSvgIndex,
      setEditingTableIndex,
      setEditingTextIndex,
    ],
  );

  const editBullets = useCallback(
    (index: number) => {
      const element = slide.elements[index];
      setEditingBulletsDraft(
        element?.type === "text-list" ? textListStrings(element).join("\n") : "",
      );
      setEditingTableIndex(null);
      setEditingChartIndex(null);
      setEditingSvgIndex(null);
      setEditingTextIndex(null);
      setEditingBulletsIndex(index);
    },
    [
      setEditingBulletsDraft,
      setEditingBulletsIndex,
      setEditingChartIndex,
      setEditingSvgIndex,
      setEditingTableIndex,
      setEditingTextIndex,
      slide.elements,
    ],
  );

  const editTable = useCallback(
    (index: number) => {
      const element = slide.elements[index];
      setEditingTableDraft(
        element?.type === "table" ? tableDraftFromElement(element) : "",
      );
      setEditingTextIndex(null);
      setEditingBulletsIndex(null);
      setEditingChartIndex(null);
      setEditingSvgIndex(null);
      setEditingTableIndex(index);
    },
    [
      setEditingBulletsIndex,
      setEditingChartIndex,
      setEditingSvgIndex,
      setEditingTableDraft,
      setEditingTableIndex,
      setEditingTextIndex,
      slide.elements,
    ],
  );

  const editChart = useCallback(
    (index: number) => {
      const element = slide.elements[index];
      setEditingChartDraft(
        element?.type === "chart" ? chartDraftFromElement(element) : "",
      );
      setEditingTextIndex(null);
      setEditingBulletsIndex(null);
      setEditingTableIndex(null);
      setEditingSvgIndex(null);
      setEditingChartIndex(index);
    },
    [
      setEditingBulletsIndex,
      setEditingChartDraft,
      setEditingChartIndex,
      setEditingSvgIndex,
      setEditingTableIndex,
      setEditingTextIndex,
      slide.elements,
    ],
  );

  const editSvg = useCallback(
    (index: number) => {
      const element = slide.elements[index];
      setEditingSvgDraft(
        element?.type === "svg" ? svgDraftFromElement(element) : "",
      );
      setEditingTextIndex(null);
      setEditingBulletsIndex(null);
      setEditingTableIndex(null);
      setEditingChartIndex(null);
      setEditingSvgIndex(index);
    },
    [
      setEditingBulletsIndex,
      setEditingChartIndex,
      setEditingSvgDraft,
      setEditingSvgIndex,
      setEditingTableIndex,
      setEditingTextIndex,
      slide.elements,
    ],
  );

  return {
    editingBulletsIndex,
    editingChartIndex,
    editingNestedElement,
    groupEditRootIndex,
    editingSvgIndex,
    editingTableIndex,
    editingTextIndex,
    onChange: (index: number, element: SlideElement) =>
      updateElement({ index, element }),
    onChangeMany: updateElements,
    onDelete: deleteSelected,
    onEditBullets: editBullets,
    onEditChart: editChart,
    onEditImage,
    onEditSvg: editSvg,
    onEditTable: editTable,
    onEditText: editText,
    onEditNestedText: (selection: NestedElementSelection) =>
      editNestedText(selection),
    onEnterGroupEdit: (index: number) => enterGroupEdit(index),
    onSelect: (index: number, additive?: boolean) =>
      selectElement({ index, additive }),
    onSelectMany: selectElements,
    onSelectNested: (selection: NestedElementSelection | null) =>
      selectNestedElement(selection),
    onSelectTableCell: (index: number, rowIndex: number, colIndex: number) => {
      setSelectedTableCell({ elementIndex: index, rowIndex, colIndex });
    },
    selected,
    selectedItems,
    selectedNestedElement,
  };
}
