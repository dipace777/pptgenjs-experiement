import type { TableSlideElement } from "../state";
import { PT_TO_PX, PX_PER_IN, withHash } from "../editorUtils";
import { inlineStyles } from "./inlineStyles";

export function TableInlineEditor({
  element,
  index,
  scale,
  draft,
  onDraftChange,
  onChange,
  onClose,
}: {
  element: TableSlideElement;
  index: number;
  scale: number;
  draft: string;
  onDraftChange: (draft: string) => void;
  onChange: (index: number, element: TableSlideElement) => void;
  onClose: () => void;
}) {
  return (
    <textarea
      autoFocus
      value={draft}
      onChange={(event) => {
        const nextDraft = event.target.value;
        onDraftChange(nextDraft);
        const rows = nextDraft
          .split("\n")
          .map((line) =>
            line
              .split(",")
              .map((cell) => cell.trim())
              .slice(0, 6),
          )
          .filter((row) => row.some(Boolean))
          .slice(0, 8);
        if (rows.length >= 2) onChange(index, { ...element, rows });
      }}
      onBlur={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") event.currentTarget.blur();
      }}
      style={{
        ...inlineStyles.textEditor,
        left: element.x * scale,
        top: element.y * scale,
        width: element.w * scale,
        height: element.h * scale,
        color: withHash(element.textColor),
        fontFamily: `${element.fontFace ?? "Arial"}, Helvetica, sans-serif`,
        fontSize: element.fontSize * PT_TO_PX * (scale / PX_PER_IN),
        lineHeight: 1.35,
      }}
    />
  );
}
