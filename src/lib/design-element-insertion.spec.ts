import { describe, expect, it } from "vitest";
import { prepareDesignElementsForInsertion } from "./design-element-insertion";
import type { RectangleElement, SlideElement, TextElement } from "./slide-schema";

function textElement(color = "111827"): TextElement {
  return {
    type: "text",
    position: { x: 0.1, y: 0.1 },
    size: { width: 2.2, height: 0.35 },
    font: { family: "Inter", size: 16, color },
    runs: [{ text: "Reusable body text" }],
  };
}

function cardBackground(): RectangleElement {
  return {
    type: "rectangle",
    position: { x: 0, y: 0 },
    size: { width: 2.8, height: 1.1 },
    fill: { color: "F8FAFC" },
    borderRadius: { tl: 0.08, tr: 0.08, bl: 0.08, br: 0.08 },
  };
}

function group(children: SlideElement[]): SlideElement {
  return {
    type: "group",
    position: { x: 1, y: 1 },
    size: { width: 3, height: 1.3 },
    children,
  };
}

function firstNestedText(element: SlideElement): TextElement | undefined {
  if (element.type === "text") return element;
  if (element.type === "group" || element.type === "flex" || element.type === "grid") {
    return element.children.find(
      (child): child is TextElement => child.type === "text",
    );
  }
  return undefined;
}

describe("design element insertion", () => {
  it("recolors floating text when inserted onto a dark slide background", () => {
    const [inserted] = prepareDesignElementsForInsertion(
      [group([textElement("111827")])],
      "141414",
    );

    expect(firstNestedText(inserted!)?.font?.color).toBe("F8FAFC");
  });

  it("preserves text color when the design element has its own readable surface", () => {
    const [inserted] = prepareDesignElementsForInsertion(
      [group([cardBackground(), textElement("111827")])],
      "141414",
    );

    expect(firstNestedText(inserted!)?.font?.color).toBe("111827");
  });
});
