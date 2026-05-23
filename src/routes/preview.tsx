/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { SlideEditor } from "../components/slide-editor";
import { DeckSchema, type Deck } from "../lib/slide-schema";
import { layoutKitDeck } from "../templates/layout-kit";

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const deck = readStoredDeck();

  return <SlideEditor key={deck.title} initialDeck={deck} />;
}

function readStoredDeck(): Deck {
  if (typeof window === "undefined") return layoutKitDeck;
  try {
    const raw = window.sessionStorage.getItem("ppty:generatedDeck");
    if (!raw) return layoutKitDeck;
    const parsed = DeckSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : layoutKitDeck;
  } catch {
    return layoutKitDeck;
  }
}
