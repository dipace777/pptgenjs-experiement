import type { Deck } from "../lib/slide-schema";
import { coffeeMarketingDeck } from "./coffee-marketing";
import { layoutKitDeck } from "./layout-kit";
import { pitchDeck } from "./pitch-deck";

export type TemplateDescriptor = {
  id: string;
  label: string;
  description: string;
  deck: Deck;
};

export const TEMPLATES: ReadonlyArray<TemplateDescriptor> = [
  {
    id: "layout-kit",
    label: "Layout Kit",
    description: "Twenty common slide patterns built from editable elements.",
    deck: layoutKitDeck,
  },
  {
    id: "coffee-marketing",
    label: "Coffee Marketing",
    description: "A premium coffee launch campaign with high-impact editable visuals.",
    deck: coffeeMarketingDeck,
  },
  {
    id: "pitch-deck",
    label: "Pitch Deck",
    description: "A ten-slide narrative pitch from cover through ask.",
    deck: pitchDeck,
  },
];

export { coffeeMarketingDeck, layoutKitDeck, pitchDeck };
