/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { SlideEditor } from "../components/slide-editor";
import {
  readPreviewDeckStorageDebugSnapshot,
  type PreviewDeckPayload,
} from "../lib/deck-storage";
import { savePptxContentJsonSchema } from "../lib/pptx-content-save";
import { generateDeckContentJsonSchema } from "../lib/slide-content-schema";
import type { SlideElement } from "../lib/slide-schema";

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const [payload, setPayload] = useState<PreviewDeckPayload | null>();
  const savePptxContentFn = useServerFn(savePptxContentJsonSchema);

  useEffect(() => {
    let isMounted = true;

    void readPreviewDeckStorageDebugSnapshot().then((snapshot) => {
      console.log("preview generatedDeck storage snapshot:", snapshot);
      if (snapshot.indexedDbValue !== undefined) {
        console.log("preview IndexedDB generatedDeck raw:", snapshot.indexedDbValue);
      }
      if (snapshot.parsedPayload?.deck) {
        console.log("preview generatedDeck deck:", snapshot.parsedPayload.deck);
      }
      if (snapshot.parsedPayload?.componentTemplates) {
        console.log(
          "preview generatedDeck componentTemplates:",
          snapshot.parsedPayload.componentTemplates,
        );
      }
      if (snapshot.parsedPayload) {
        console.log(
          "preview generatedDeck semantic summary:",
          semanticSummary(snapshot.parsedPayload),
        );
      }
      if (isMounted) {
        setPayload(snapshot.parsedPayload);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (payload === undefined) {
    return <main style={loadingStyle}>Loading deck...</main>;
  }

  if (payload === null) {
    return (
      <main style={loadingStyle}>
        <section style={emptyStateStyle}>
          <h1 style={emptyTitleStyle}>No preview deck found</h1>
          <p style={emptyTextStyle}>
            Import or generate a deck again to open a preview.
          </p>
        </section>
      </main>
    );
  }

  return (
    <SlideEditor
      key={previewDeckKey(payload)}
      componentTemplates={payload.componentTemplates}
      initialDeck={payload.deck}
      onSave={(deck) => {
        const jsonSchema = generateDeckContentJsonSchema(deck);
        void savePptxContentFn({
          data: {
            rawPptxJson: deck,
            jsonSchema,
          },
        })
          .then((result) => {
            console.log("preview saved raw PPTX JSON and JSON schema:", result);
          })
          .catch((error) => {
            console.error(
              "preview failed to save raw PPTX JSON and JSON schema:",
              error,
            );
          });
      }}
      saveButtonTitle="Save raw PPTX JSON and content JSON schema"
    />
  );
}

function previewDeckKey(payload: PreviewDeckPayload) {
  const firstSlide = payload.deck.slides[0];
  return [
    payload.deck.title,
    payload.deck.slides.length,
    firstSlide?.elements.length ?? 0,
    payload.componentTemplates?.length ?? 0,
  ].join(":");
}

function semanticSummary(payload: PreviewDeckPayload) {
  const deckElements = payload.deck.slides.flatMap((slide) => slide.elements);
  const templateElements =
    payload.componentTemplates?.flatMap((template) => template.elements) ?? [];

  return {
    deck: semanticCounts(deckElements),
    componentTemplates: semanticCounts(templateElements),
    templateCount: payload.componentTemplates?.length ?? 0,
  };
}

function semanticCounts(elements: SlideElement[]) {
  const counts: SemanticCounts = {
    topLevel: {
      container: 0,
      flex: 0,
      grid: 0,
      group: 0,
      listView: 0,
      gridView: 0,
    },
    nested: {
      container: 0,
      flex: 0,
      grid: 0,
      group: 0,
      listView: 0,
      gridView: 0,
    },
    totalElements: 0,
  };

  elements.forEach((element) => countElement(element, counts, true));
  return counts;
}

type SemanticCounts = {
  topLevel: SemanticBucket;
  nested: SemanticBucket;
  totalElements: number;
};

type SemanticBucket = {
  container: number;
  flex: number;
  grid: number;
  group: number;
  listView: number;
  gridView: number;
};

function countElement(
  element: SlideElement,
  counts: SemanticCounts,
  topLevel: boolean,
) {
  counts.totalElements += 1;
  const bucket = topLevel ? counts.topLevel : counts.nested;

  if (element.type === "container") {
    bucket.container += 1;
    if (element.child) countElement(element.child, counts, false);
    return;
  }

  if (element.type === "flex") {
    bucket.flex += 1;
    element.children.forEach((child) => countElement(child, counts, false));
    return;
  }

  if (element.type === "grid") {
    bucket.grid += 1;
    element.children.forEach((child) => countElement(child, counts, false));
    return;
  }

  if (element.type === "group") {
    bucket.group += 1;
    element.children.forEach((child) => countElement(child, counts, false));
    return;
  }

  if (element.type === "list-view") {
    bucket.listView += 1;
    countElement(element.item, counts, false);
    return;
  }

  if (element.type === "grid-view") {
    bucket.gridView += 1;
    countElement(element.item, counts, false);
  }
}

const loadingStyle = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background: "#080B12",
  color: "#E8EDF7",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  fontSize: 18,
  fontWeight: 700,
} satisfies React.CSSProperties;

const emptyStateStyle = {
  maxWidth: 520,
  padding: 24,
  textAlign: "center",
} satisfies React.CSSProperties;

const emptyTitleStyle = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.1,
} satisfies React.CSSProperties;

const emptyTextStyle = {
  margin: "12px 0 0",
  color: "#AAB4C5",
  fontSize: 16,
  lineHeight: 1.5,
  fontWeight: 500,
} satisfies React.CSSProperties;
