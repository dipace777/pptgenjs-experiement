import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { generatePptx } from "../slide/generatePptx";
import { generateDeck, type GenerateDeckInput } from "../slide/generateDeck";
import { messiDeck } from "../slide/spec";
import type { Deck } from "../slide/spec";
import { DeckPreview } from "../slide/DeckPreview";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const [deck, setDeck] = useState<Deck>(messiDeck);
  const [previewVersion, setPreviewVersion] = useState(0);
  const generateDeckFn = useServerFn(generateDeck);

  const handleDownload = () => {
    void generatePptx(
      deck,
      `${deck.title.toLowerCase().replace(/\W+/g, "-")}.pptx`,
    );
  };

  const handleGenerate = async (input: GenerateDeckInput) => {
    const generatedDeck = await generateDeckFn({ data: input });
    setDeck(generatedDeck);
    setPreviewVersion((version) => version + 1);
  };

  return (
    <DeckPreview
      key={previewVersion}
      deck={deck}
      onDownload={handleDownload}
      onGenerate={handleGenerate}
    />
  );
}
