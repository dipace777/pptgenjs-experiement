import type { DeckTheme, Slide, SlideElement } from "../../lib/slide-schema";

export type ComponentTemplate = {
  id: string;
  label: string;
  description?: string;
  elements: SlideElement[];
  intent?: string;
  qualityScore?: number;
  slots?: Array<{
    elementIndexes: number[];
    kind: string;
    name: string;
    role: string;
    text?: string;
  }>;
};

export type SlideTemplate = {
  id: string;
  label: string;
  description?: string;
  slide: Slide;
};

export function createSlideTemplatesFromDeck(deck: {
  slides: Slide[];
  theme?: DeckTheme | null;
}) {
  const blank = createBlankSlide(deck.theme?.background ?? deck.slides[0]?.background);
  return [
    {
      id: "blank",
      label: "Blank",
      description: "Empty slide",
      slide: blank,
    },
    ...deck.slides.map((slide, index): SlideTemplate => ({
      id: `${index}-${slide.title ?? "slide"}`,
      label: slide.title ?? `Slide ${index + 1}`,
      description: `${slide.elements.length} elements`,
      slide,
    })),
  ];
}

function createBlankSlide(background = "FFFFFF"): Slide {
  return {
    background: stripHash(background),
    elements: [],
  };
}

function stripHash(color: string) {
  return color.replace("#", "").toUpperCase();
}
