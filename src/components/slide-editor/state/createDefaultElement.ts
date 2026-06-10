import type { SlideElement } from "../../../lib/slide-schema";
import type { ElementKind } from "../../../lib/slide-elements";
import { createDefaultElementFromRegistry } from "../registry";

export function createDefaultElement(kind: ElementKind): SlideElement {
  return createDefaultElementFromRegistry(kind);
}
