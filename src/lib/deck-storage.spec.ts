import { describe, expect, it } from "vitest";
import { createDesignElementExtraction } from "./design-element-extraction";
import { parsePreviewDeckPayload } from "./deck-storage";
import exampleDeckRaw from "./example-deck.json?raw";
import { DeckSchema, type Deck } from "./slide-schema";

const deck: Deck = {
  title: "Imported deck",
  slides: [
    {
      background: "FFFFFF",
      elements: [
        {
          type: "text",
          position: { x: 1, y: 1 },
          size: { width: 2, height: 0.4 },
          runs: [{ text: "Imported slide content" }],
        },
      ],
    },
  ],
};

describe("preview deck storage", () => {
  it("keeps a valid imported deck even when extracted component templates are invalid", () => {
    const payload = parsePreviewDeckPayload({
      deck,
      componentTemplates: [
        {
          id: "bad-template",
          label: "Bad Template",
          elements: [],
        },
      ],
    });

    expect(payload?.deck.title).toBe("Imported deck");
    expect(payload?.deck.slides[0]?.elements[0]).toMatchObject({
      type: "text",
    });
    expect(payload?.componentTemplates).toBeUndefined();
  });

  it("keeps valid design elements when another extracted template is invalid", () => {
    const payload = parsePreviewDeckPayload({
      deck,
      componentTemplates: [
        {
          id: "valid-template",
          label: "Valid Template",
          elements: [deck.slides[0]!.elements[0]!],
        },
        {
          id: "bad-template",
          label: "Bad Template",
          elements: [],
        },
      ],
    });

    expect(payload?.componentTemplates).toHaveLength(1);
    expect(payload?.componentTemplates?.[0]?.id).toBe("valid-template");
  });

  it("parses the legacy raw deck handoff shape", () => {
    expect(parsePreviewDeckPayload(deck)?.deck.title).toBe("Imported deck");
  });

  it("preserves real extracted design elements through the preview payload", () => {
    const importedDeck = JSON.parse(exampleDeckRaw) as Deck;
    const extraction = createDesignElementExtraction(importedDeck);

    expect(DeckSchema.safeParse(importedDeck).success).toBe(true);
    const payload = parsePreviewDeckPayload({
      deck: importedDeck,
      componentTemplates: extraction.templates,
    });

    expect(extraction.templates.length).toBeGreaterThan(0);
    expect(payload?.componentTemplates).toHaveLength(extraction.templates.length);
  });
});
