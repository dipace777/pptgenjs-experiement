import type { Deck } from "../lib/slide-schema";
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
    description: "Nineteen common slide patterns built from editable elements.",
    deck: layoutKitDeck,
  },
  {
    id: "pitch-deck",
    label: "Pitch Deck",
    description: "A ten-slide narrative pitch from cover through ask.",
    deck: pitchDeck,
  },
];

export { layoutKitDeck, pitchDeck };
