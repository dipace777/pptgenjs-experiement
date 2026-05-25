import type { SlideElement } from "../../lib/slide-schema";

export type ComponentTemplate = {
  id: string;
  label: string;
  description?: string;
  elements: SlideElement[];
};
