import { useHotkey } from "@tanstack/react-hotkeys";
import { Provider, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useHydrateAtoms } from "jotai/utils";
import { useMemo, useState, type ReactNode } from "react";
import type { Deck } from "../../lib/slide-schema";
import { layoutKitDeck } from "../../templates/layout-kit";
import {
  createSlideTemplatesFromDeck,
  type ComponentTemplate,
  type SlideTemplate,
} from "./componentTemplates";
import { DeckThemeDrawer, SlideEditorDrawer, SlideLayoutDrawer } from "./panels";
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
  insertSlideAtom,
  presentingAtom,
  redoAtom,
  undoAtom,
} from "./state";

export function SlideEditor({
  componentTemplates = [],
  initialDeck = layoutKitDeck,
  slideTemplates,
  toolbarLeading,
}: {
  componentTemplates?: ReadonlyArray<ComponentTemplate>;
  initialDeck?: Deck;
  slideTemplates?: ReadonlyArray<SlideTemplate>;
  toolbarLeading?: ReactNode;
}) {
  const resolvedSlideTemplates = useMemo(
    () => slideTemplates ?? createSlideTemplatesFromDeck(initialDeck),
    [initialDeck, slideTemplates],
  );

  return (
    <Provider>
      <SlideEditorBody
        componentTemplates={componentTemplates}
        initialDeck={initialDeck}
        slideTemplates={resolvedSlideTemplates}
        toolbarLeading={toolbarLeading}
      />
    </Provider>
  );
}

function SlideEditorBody({
  componentTemplates,
  initialDeck,
  slideTemplates,
  toolbarLeading,
}: {
  componentTemplates: ReadonlyArray<ComponentTemplate>;
  initialDeck: Deck;
  slideTemplates: ReadonlyArray<SlideTemplate>;
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
  const [slideLayoutOpen, setSlideLayoutOpen] = useState(false);
  const insertSlide = useSetAtom(insertSlideAtom);
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
          canInsertSlide={slideTemplates.length > 0 && deck.slides.length < 50}
          onInsertSlide={() => setSlideLayoutOpen(true)}
        />
      </main>

      {editorOpen ? (
        <SlideEditorDrawer
          componentTemplates={componentTemplates}
          onClose={() => setEditorOpen(false)}
        />
      ) : null}

      {slideLayoutOpen ? (
        <SlideLayoutDrawer
          anchorOffset={editorOpen ? 360 : 0}
          insertAfterIndex={active}
          slideTemplates={slideTemplates}
          onClose={() => setSlideLayoutOpen(false)}
          onInsert={(slide) => {
            insertSlide(slide);
            setSlideLayoutOpen(false);
          }}
        />
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
