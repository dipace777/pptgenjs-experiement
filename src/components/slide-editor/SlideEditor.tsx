import { useHotkey } from "@tanstack/react-hotkeys";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { useState, type ReactNode } from "react";
import type { Deck } from "../../lib/slide-schema";
import { layoutKitDeck } from "../../templates/layout-kit";
import { DeckThemeDrawer, SlideEditorDrawer } from "./panels";
import { PresentationMode } from "./PresentationMode";
import {
  EditorTopbar,
  HiddenExportStages,
  ThumbnailRail,
  layoutStyles,
} from "./shell";
import { SlideWorkspace } from "./workspace";
import {
  useDeckExport,
  useDeleteShortcut,
  useImageUpload,
  useStageSize,
} from "./hooks";
import {
  activeSlideIndexAtom,
  deckAtom,
  editorOpenAtom,
  presentingAtom,
  redoAtom,
  undoAtom,
} from "./state";

export function SlideEditor({
  initialDeck = layoutKitDeck,
  toolbarLeading,
}: {
  initialDeck?: Deck;
  toolbarLeading?: ReactNode;
}) {
  return (
    <Provider>
      <SlideEditorBody initialDeck={initialDeck} toolbarLeading={toolbarLeading} />
    </Provider>
  );
}

function SlideEditorBody({
  initialDeck,
  toolbarLeading,
}: {
  initialDeck: Deck;
  toolbarLeading?: ReactNode;
}) {
  useHydrateAtoms([[deckAtom, initialDeck]]);
  useEditorHotkeys();
  useDeleteShortcut();

  const deck = useAtomValue(deckAtom);
  const active = useAtomValue(activeSlideIndexAtom);
  const [editorOpen, setEditorOpen] = useAtom(editorOpenAtom);
  const [presenting, setPresenting] = useAtom(presentingAtom);
  const [themeOpen, setThemeOpen] = useState(false);
  const { stageWidth, stageWrapRef } = useStageSize();
  const { exportStageRefs, exportingType, handleExport, handlePdfExport } =
    useDeckExport();
  const { imageUploadInputRef, openImageUpload, handleImageUploadChange } =
    useImageUpload();

  return (
    <div style={layoutStyles.shell}>
      <ThumbnailRail />

      <main style={layoutStyles.main}>
        <EditorTopbar
          exportingType={exportingType}
          onExport={handleExport}
          onPdfExport={handlePdfExport}
          onOpenTheme={() => setThemeOpen(true)}
          toolbarLeading={toolbarLeading}
        />

        <SlideWorkspace
          stageWrapRef={stageWrapRef}
          stageWidth={stageWidth}
          imageUploadInputRef={imageUploadInputRef}
          onImageUploadChange={handleImageUploadChange}
          onEditImage={openImageUpload}
        />
      </main>

      {editorOpen ? (
        <SlideEditorDrawer onClose={() => setEditorOpen(false)} />
      ) : null}

      {themeOpen ? <DeckThemeDrawer onClose={() => setThemeOpen(false)} /> : null}

      {presenting ? (
        <PresentationMode
          deck={deck}
          startIndex={active}
          onClose={() => setPresenting(false)}
        />
      ) : null}

      <HiddenExportStages
        slides={deck.slides}
        exportStageRefs={exportStageRefs}
      />
    </div>
  );
}

function useEditorHotkeys() {
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);

  useHotkey("Mod+Z", (event) => {
    event.preventDefault();
    undo();
  });
  useHotkey("Mod+Shift+Z", (event) => {
    event.preventDefault();
    redo();
  });
  useHotkey("Mod+Y", (event) => {
    event.preventDefault();
    redo();
  });
}
