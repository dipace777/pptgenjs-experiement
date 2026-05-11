import { DeckPreview } from "./slide/DeckPreview";
import { generatePptx } from "./slide/generatePptx";
import { messiDeck } from "./slide/spec";

function App() {
  const handleDownload = () => {
    void generatePptx(messiDeck, "lionel-messi.pptx");
  };

  return <DeckPreview deck={messiDeck} onDownload={handleDownload} />;
}

export default App;
