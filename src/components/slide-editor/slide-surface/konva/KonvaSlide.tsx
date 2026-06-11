import Konva from "konva";
import {
  SLIDE_W,
  type Slide,
  type SlideElement,
} from "../../../../lib/slide-schema";
import type { NestedElementSelection } from "../../state";
import { ElementLayer } from "./ElementLayer";
import { useEditorCanvasInteractions } from "./hooks/useEditorCanvasInteractions";
import { useKonvaSelection } from "./hooks/useKonvaSelection";
import { useSelectionBox } from "./hooks/useSelectionBox";
import { SlideStage } from "./SlideStage";

export function KonvaSlide({
  slide,
  width,
  height,
  interactive,
  selected,
  selectedItems,
  onSelect,
  onSelectMany,
  onDelete,
  onEditText,
  onEditBullets,
  onEditChart,
  onEditImage,
  onEditSvg,
  onEditTable,
  onEditNestedText,
  onEnterGroupEdit,
  onSelectTableCell,
  onSelectNested,
  onChange,
  onChangeMany,
  stageRef,
  bulletsRenderMode,
  chartRenderMode,
  tableRenderMode,
  textRenderMode,
  editingTextIndex,
  editingBulletsIndex,
  editingChartIndex,
  editingNestedElement,
  editingSvgIndex,
  editingTableIndex,
  groupEditRootIndex,
}: {
  slide: Slide;
  width: number;
  height: number;
  interactive: boolean;
  selected?: number;
  selectedItems?: number[];
  onSelect?: (index: number, additive?: boolean) => void;
  onSelectMany?: (indexes: number[]) => void;
  onDelete?: () => void;
  onEditText?: (index: number) => void;
  onEditBullets?: (index: number) => void;
  onEditChart?: (index: number) => void;
  onEditImage?: (index: number) => void;
  onEditSvg?: (index: number) => void;
  onEditTable?: (index: number) => void;
  onEditNestedText?: (selection: NestedElementSelection) => void;
  onEnterGroupEdit?: (index: number) => void;
  onSelectTableCell?: (
    index: number,
    rowIndex: number,
    colIndex: number,
  ) => void;
  onSelectNested?: (selection: NestedElementSelection | null) => void;
  onChange?: (index: number, element: SlideElement) => void;
  onChangeMany?: (
    updates: Array<{ index: number; element: SlideElement }>,
  ) => void;
  stageRef?: (stage: Konva.Stage | null) => void;
  bulletsRenderMode?: "canvas" | "proxy";
  chartRenderMode?: "canvas" | "proxy";
  tableRenderMode?: "canvas" | "proxy";
  textRenderMode?: "canvas" | "proxy";
  editingTextIndex?: number | null;
  editingBulletsIndex?: number | null;
  editingChartIndex?: number | null;
  editingNestedElement?: NestedElementSelection | null;
  editingSvgIndex?: number | null;
  editingTableIndex?: number | null;
  groupEditRootIndex?: number | null;
}) {
  const scale = width / SLIDE_W;
  const editorInteractions = useEditorCanvasInteractions({
    onEditImage,
    slide,
  });
  const resolvedSelected =
    selected ?? (interactive ? editorInteractions.selected : undefined);
  const resolvedSelectedItems =
    selectedItems ??
    (interactive ? editorInteractions.selectedItems : undefined);
  const resolvedEditingTextIndex =
    editingTextIndex ??
    (interactive ? editorInteractions.editingTextIndex : undefined);
  const resolvedEditingBulletsIndex =
    editingBulletsIndex ??
    (interactive ? editorInteractions.editingBulletsIndex : undefined);
  const resolvedEditingChartIndex =
    editingChartIndex ??
    (interactive ? editorInteractions.editingChartIndex : undefined);
  const resolvedEditingNestedElement =
    editingNestedElement ??
    (interactive ? editorInteractions.editingNestedElement : undefined);
  const resolvedEditingSvgIndex =
    editingSvgIndex ??
    (interactive ? editorInteractions.editingSvgIndex : undefined);
  const resolvedEditingTableIndex =
    editingTableIndex ??
    (interactive ? editorInteractions.editingTableIndex : undefined);
  const resolvedGroupEditRootIndex =
    groupEditRootIndex ??
    (interactive ? editorInteractions.groupEditRootIndex : undefined);
  const resolvedOnSelect =
    onSelect ?? (interactive ? editorInteractions.onSelect : undefined);
  const resolvedOnSelectMany =
    onSelectMany ?? (interactive ? editorInteractions.onSelectMany : undefined);
  const resolvedOnDelete =
    onDelete ?? (interactive ? editorInteractions.onDelete : undefined);
  const resolvedOnEditText =
    onEditText ?? (interactive ? editorInteractions.onEditText : undefined);
  const resolvedOnEditBullets =
    onEditBullets ??
    (interactive ? editorInteractions.onEditBullets : undefined);
  const resolvedOnEditChart =
    onEditChart ?? (interactive ? editorInteractions.onEditChart : undefined);
  const resolvedOnEditImage =
    onEditImage ?? (interactive ? editorInteractions.onEditImage : undefined);
  const resolvedOnEditSvg =
    onEditSvg ?? (interactive ? editorInteractions.onEditSvg : undefined);
  const resolvedOnEditTable =
    onEditTable ?? (interactive ? editorInteractions.onEditTable : undefined);
  const resolvedOnSelectTableCell =
    onSelectTableCell ??
    (interactive ? editorInteractions.onSelectTableCell : undefined);
  const resolvedOnEditNestedText =
    onEditNestedText ??
    (interactive ? editorInteractions.onEditNestedText : undefined);
  const resolvedOnEnterGroupEdit =
    onEnterGroupEdit ??
    (interactive ? editorInteractions.onEnterGroupEdit : undefined);
  const resolvedOnSelectNested =
    onSelectNested ??
    (interactive ? editorInteractions.onSelectNested : undefined);
  const resolvedOnChange =
    onChange ?? (interactive ? editorInteractions.onChange : undefined);
  const resolvedOnChangeMany =
    onChangeMany ?? (interactive ? editorInteractions.onChangeMany : undefined);
  const { nodeRefs, selectedBounds, selectedIndexes, transformerRef } =
    useKonvaSelection({
      interactive,
      scale,
      selected: resolvedSelected,
      selectedItems: resolvedSelectedItems,
      slide,
    });
  const { normalizedSelectionBox, stageHandlers } = useSelectionBox({
    interactive,
    onSelect: resolvedOnSelect,
    onSelectMany: resolvedOnSelectMany,
    scale,
    slide,
  });

  return (
    <SlideStage
      height={height}
      interactive={interactive}
      slide={slide}
      stageHandlers={stageHandlers}
      stageRef={stageRef}
      width={width}
    >
      <ElementLayer
        editingBulletsIndex={resolvedEditingBulletsIndex}
        editingChartIndex={resolvedEditingChartIndex}
        editingNestedElement={resolvedEditingNestedElement}
        editingSvgIndex={resolvedEditingSvgIndex}
        editingTableIndex={resolvedEditingTableIndex}
        editingTextIndex={resolvedEditingTextIndex}
        groupEditRootIndex={resolvedGroupEditRootIndex}
        interactive={interactive}
        nodeRefs={nodeRefs}
        normalizedSelectionBox={normalizedSelectionBox}
        bulletsRenderMode={bulletsRenderMode}
        chartRenderMode={chartRenderMode}
        onChange={resolvedOnChange}
        onChangeMany={resolvedOnChangeMany}
        onDelete={resolvedOnDelete}
        onEditBullets={resolvedOnEditBullets}
        onEditChart={resolvedOnEditChart}
        onEditImage={resolvedOnEditImage}
        onEditSvg={resolvedOnEditSvg}
        onEditTable={resolvedOnEditTable}
        onEditText={resolvedOnEditText}
        onEditNestedText={resolvedOnEditNestedText}
        onEnterGroupEdit={resolvedOnEnterGroupEdit}
        onSelect={resolvedOnSelect}
        onSelectMany={resolvedOnSelectMany}
        onSelectNested={resolvedOnSelectNested}
        onSelectTableCell={resolvedOnSelectTableCell}
        scale={scale}
        selectedBounds={selectedBounds}
        selectedIndexes={selectedIndexes}
        selectedNestedElement={editorInteractions.selectedNestedElement}
        slide={slide}
        tableRenderMode={tableRenderMode}
        textRenderMode={textRenderMode}
        transformerRef={transformerRef}
        width={width}
        height={height}
      />
    </SlideStage>
  );
}
