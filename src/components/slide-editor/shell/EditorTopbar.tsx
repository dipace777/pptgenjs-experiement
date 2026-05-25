import { useAtom, useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { styles } from "../editorStyles";
import { truncateWords } from "../editorUtils";
import { ExportPptxButton } from "../shared/ExportPptxButton";
import {
  activeSlideAtom,
  activeSlideIndexAtom,
  deckAtom,
  exportModeAtom,
  isExportingAtom,
  presentingAtom,
} from "../state";
import { layoutStyles } from "./layoutStyles";

type EditorTopbarProps = {
  exportingType: "pptx" | "pdf" | null;
  onExport: () => void;
  onPdfExport: () => void;
  onOpenTheme: () => void;
  toolbarLeading?: ReactNode;
};

export function EditorTopbar({
  exportingType,
  onExport,
  onPdfExport,
  onOpenTheme,
  toolbarLeading,
}: EditorTopbarProps) {
  const deck = useAtomValue(deckAtom);
  const active = useAtomValue(activeSlideIndexAtom);
  const activeSlide = useAtomValue(activeSlideAtom);
  const isExporting = useAtomValue(isExportingAtom);
  const [exportMode, setExportMode] = useAtom(exportModeAtom);
  const [, setPresenting] = useAtom(presentingAtom);

  return (
    <div style={layoutStyles.topbar}>
      <div>
        <div style={layoutStyles.currentTitle}>
          {activeSlide.title ?? `Slide ${active + 1}`}
        </div>
        <div style={layoutStyles.meta}>
          {deck.description
            ? truncateWords(deck.description, 6)
            : "React + Konva live preview; JSON remains the source of truth."}
        </div>
      </div>
      <div style={layoutStyles.toolbar}>
        {toolbarLeading}
        <button
          type="button"
          onClick={onOpenTheme}
          style={styles.ghostButton}
          title="Configure deck theme"
        >
          Theme
        </button>
        <button
          type="button"
          onClick={() => setPresenting(true)}
          style={styles.ghostButton}
          title="Start presentation (fullscreen)"
        >
          <span aria-hidden="true">▶</span>
          Slide Show
        </button>
        <button
          type="button"
          disabled={isExporting}
          onClick={onPdfExport}
          style={styles.secondaryButton}
        >
          {exportingType === "pdf" ? "Exporting PDF..." : "Export PDF"}
        </button>
        <ExportPptxButton
          mode={exportMode}
          onModeChange={setExportMode}
          onExport={onExport}
          isExporting={isExporting}
          exportingLabel={exportingType === "pptx" ? "Exporting PPTX..." : null}
        />
      </div>
    </div>
  );
}
