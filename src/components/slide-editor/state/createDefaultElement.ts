import type { SlideElement } from "../../../lib/slide-schema";

const base = { x: 0.8, y: 0.8, w: 2.6, h: 0.7 } as const;

export function createDefaultElement(kind: SlideElement["kind"]): SlideElement {
  switch (kind) {
    case "rect":
      return { ...base, kind, fill: "D4A24C", rx: 0.08 };
    case "ellipse":
      return { ...base, kind, fill: "75AADB" };
    case "chart":
      return {
        ...base,
        w: 4.2,
        h: 1.8,
        kind,
        chartType: "bar",
        title: "Chart title",
        color: "D4A24C",
        axisColor: "9AA7BD",
        labelColor: "6A7894",
        showValues: true,
        data: [
          { label: "A", value: 42, color: "D4A24C" },
          { label: "B", value: 68, color: "3E78B2" },
          { label: "C", value: 54, color: "0B1F3A" },
        ],
      };
    case "table":
      return {
        ...base,
        w: 5.2,
        h: 2.1,
        kind,
        rows: [
          ["Metric", "Current", "Target"],
          ["Adoption", "52%", "70%"],
          ["Revenue", "$1.2M", "$1.8M"],
          ["Retention", "84%", "90%"],
        ],
        fontFace: "Arial",
        fontSize: 11,
        textColor: "1A2B45",
        headerFill: "0B1F3A",
        headerTextColor: "FFFFFF",
        borderColor: "DDE5F0",
        fill: "FFFFFF",
      };
    case "image":
      return { ...base, w: 3.6, h: 2.4, kind, fit: "contain" };
    case "bullets":
      return {
        ...base,
        h: 1.35,
        kind,
        items: ["First point", "Second point"],
        fontFace: "Arial",
        fontSize: 18,
        color: "1A2B45",
        lineSpacingMultiple: 1.25,
        itemGap: 0.08,
      };
    case "text":
      return {
        ...base,
        w: 4.2,
        h: 0.7,
        kind,
        text: "New text",
        fontFace: "Arial",
        fontSize: 28,
        bold: true,
        color: "1A2B45",
      };
  }
}
