/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from "@tanstack/react-router";
import { SlideEditor } from "../components/slide-editor";
import { DeckSchema, type Deck } from "../lib/slide-schema";
import { messiDeck } from "../slide/spec";

export const Route = createFileRoute("/preview")({
  component: PreviewPage,
});

function PreviewPage() {
  const deck = readStoredDeck();

  return <SlideEditor key={deck.title} initialDeck={deck} />;
}

function readStoredDeck(): Deck {
  if (typeof window === "undefined") return messiDeck;
  try {
    const raw = window.sessionStorage.getItem("ppty:generatedDeck");
    if (!raw) return messiDeck;
    const parsed = DeckSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : messiDeck;
  } catch {
    return messiDeck;
  }
}
