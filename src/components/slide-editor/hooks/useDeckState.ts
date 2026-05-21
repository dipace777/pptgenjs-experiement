import { useState } from "react";
import type { Deck, Slide, SlideElement } from "../../../lib/slide-schema";

export function useDeckState(initialDeck: Deck) {
  const [deck, setDeck] = useState<Deck>(initialDeck);
  const [active, setActive] = useState(0);

  const activeSlide = deck.slides[active];

  const updateSlide = (slideIndex: number, updater: (slide: Slide) => Slide) => {
    setDeck((current) => ({
      ...current,
      slides: current.slides.map((slide, index) =>
        index === slideIndex ? updater(slide) : slide,
      ),
    }));
  };

  const updateActiveSlide = (updater: (slide: Slide) => Slide) => {
    updateSlide(active, updater);
  };

  const updateElement = (index: number, next: SlideElement) => {
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.map((el, i) => (i === index ? next : el)),
    }));
  };

  const updateElements = (
    updates: Array<{ index: number; element: SlideElement }>,
  ) => {
    updateActiveSlide((slide) => ({
      ...slide,
      elements: slide.elements.map((el, i) => {
        const update = updates.find((item) => item.index === i);
        return update ? update.element : el;
      }),
    }));
  };

  return {
    deck,
    setDeck,
    active,
    setActive,
    activeSlide,
    updateSlide,
    updateActiveSlide,
    updateElement,
    updateElements,
  };
}

export type DeckState = ReturnType<typeof useDeckState>;
