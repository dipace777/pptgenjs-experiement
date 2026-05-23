import { useAtomValue, useSetAtom } from "jotai";
import {
  BulletsToolbar,
  ImageToolbar,
  ShapeToolbar,
  TableToolbar,
  TextToolbar,
} from "../inline";
import { getElementDefinition } from "../registry";
import {
  selectedElementAtom,
  selectedIndexAtom,
  selectedTableCellAtom,
  updateElementAtom,
} from "../state";

type WorkspaceToolbarsProps = {
  scale: number;
  onEditImage: (index: number) => void;
};

export function WorkspaceToolbars({
  scale,
  onEditImage,
}: WorkspaceToolbarsProps) {
  const selectedIndex = useAtomValue(selectedIndexAtom);
  const selectedElement = useAtomValue(selectedElementAtom);
  const selectedTableCell = useAtomValue(selectedTableCellAtom);
  const updateElement = useSetAtom(updateElementAtom);

  if (!selectedElement) return null;

  const toolbar = getElementDefinition(selectedElement.kind).toolbar;

  if (toolbar === "text" && selectedElement.kind === "text") {
    return (
      <TextToolbar
        element={selectedElement}
        index={selectedIndex}
        scale={scale}
        onChange={(index, element) => updateElement({ index, element })}
      />
    );
  }

  if (toolbar === "bullets" && selectedElement.kind === "bullets") {
    return (
      <BulletsToolbar
        element={selectedElement}
        index={selectedIndex}
        scale={scale}
        onChange={(index, element) => updateElement({ index, element })}
      />
    );
  }

  if (toolbar === "image" && selectedElement.kind === "image") {
    return (
      <ImageToolbar
        element={selectedElement}
        index={selectedIndex}
        scale={scale}
        onChange={(index, element) => updateElement({ index, element })}
        onUpload={onEditImage}
      />
    );
  }

  if (
    toolbar === "shape" &&
    (selectedElement.kind === "rect" || selectedElement.kind === "ellipse")
  ) {
    return (
      <ShapeToolbar
        element={selectedElement}
        index={selectedIndex}
        scale={scale}
        onChange={(index, element) => updateElement({ index, element })}
      />
    );
  }

  if (toolbar === "table" && selectedElement.kind === "table") {
    return (
      <TableToolbar
        element={selectedElement}
        index={selectedIndex}
        scale={scale}
        selectedCell={
          selectedTableCell?.elementIndex === selectedIndex
            ? selectedTableCell
            : null
        }
        onChange={(index, element) => updateElement({ index, element })}
      />
    );
  }

  return (
    null
  );
}
