/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SlideEditor } from "../components/slide-editor";
import {
  readPreviewDeckPayload,
  type PreviewDeckPayload,
} from "../lib/deck-storage";
import { layoutKitDeck } from "../templates/layout-kit";

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const [payload, setPayload] = useState<PreviewDeckPayload | null>(null);

  useEffect(() => {
    let isMounted = true;

    void readPreviewDeckPayload().then((storedPayload) => {
      if (isMounted) setPayload(storedPayload ?? { deck: layoutKitDeck });
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!payload) return <main style={loadingStyle}>Loading deck...</main>;

  return (
    <SlideEditor
      key={`${payload.deck.title}:${payload.componentTemplates?.length ?? 0}`}
      componentTemplates={payload.componentTemplates}
      initialDeck={payload.deck}
    />
  );
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
