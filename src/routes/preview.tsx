/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SlideEditor } from "../components/slide-editor";
import { readPreviewDeck } from "../lib/deck-storage";
import type { Deck } from "../lib/slide-schema";
import { layoutKitDeck } from "../templates/layout-kit";

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const [deck, setDeck] = useState<Deck | null>(null);

  useEffect(() => {
    let isMounted = true;

    void readPreviewDeck().then((storedDeck) => {
      if (isMounted) setDeck(storedDeck ?? layoutKitDeck);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!deck) return <main style={loadingStyle}>Loading deck...</main>;

  return <SlideEditor key={deck.title} initialDeck={deck} />;
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
