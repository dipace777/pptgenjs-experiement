import { createFileRoute } from "@tanstack/react-router";
import { generatePptx } from "../slide/generatePptx";
import { messiDeck } from "../slide/spec";
import { DeckPreview } from "../slide/DeckPreview";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const handleDownload = () => {
    void generatePptx(messiDeck, "lionel-messi.pptx");
  };
  return <DeckPreview deck={messiDeck} onDownload={handleDownload} />;
}
