import { describe, expect, it } from "vitest";
import {
  createDesignElementExtraction,
  type DesignElementCandidate,
} from "./design-element-extraction";
import exampleDeckRaw from "./example-deck.json?raw";
import type {
  Deck,
  Font,
  ImageElement,
  LineElement,
  RectangleElement,
  Slide,
  SlideElement,
  SvgElement,
  TextElement,
} from "./slide-schema";

type Box = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const baseFont: Font = {
  family: "Inter",
  size: 16,
  color: "111827",
};
const exampleDeck = JSON.parse(exampleDeckRaw) as Deck;

let cachedExampleExtraction:
  | ReturnType<typeof createDesignElementExtraction>
  | null = null;

function exampleExtraction() {
  cachedExampleExtraction ??= createDesignElementExtraction(exampleDeck);
  return cachedExampleExtraction;
}

function deck(slides: Slide[]): Deck {
  return {
    title: "Design Element Spec Deck",
    slides,
  };
}

function slide(elements: SlideElement[]): Slide {
  return {
    background: "FFFFFF",
    elements,
  };
}

function geometry({ x, y, w, h }: Box) {
  return {
    position: { x, y },
    size: { width: w, height: h },
  };
}

function text(
  value: string,
  box: Box,
  font: Partial<Font> = {},
  overrides: Partial<TextElement> = {},
): TextElement {
  return {
    type: "text",
    ...geometry(box),
    font: { ...baseFont, ...font },
    runs: [{ text: value }],
    ...overrides,
  };
}

function rectangle(
  box: Box,
  overrides: Partial<RectangleElement> = {},
): RectangleElement {
  return {
    type: "rectangle",
    ...geometry(box),
    fill: { color: "F8FAFC" },
    stroke: { color: "CBD5E1", width: 1 },
    borderRadius: { tl: 0.08, tr: 0.08, bl: 0.08, br: 0.08 },
    ...overrides,
  };
}

function line(box: Box, overrides: Partial<LineElement> = {}): LineElement {
  return {
    type: "line",
    ...geometry(box),
    stroke: { color: "2563EB", width: 2 },
    ...overrides,
  };
}

function image(
  name: string,
  box: Box,
  overrides: Partial<ImageElement> = {},
): ImageElement {
  return {
    type: "image",
    ...geometry(box),
    name,
    data: `data:${name}`,
    fit: "cover",
    ...overrides,
  };
}

function svgIcon(
  name: string,
  box: Box,
  overrides: Partial<SvgElement> = {},
): SvgElement {
  return {
    type: "svg",
    ...geometry(box),
    name,
    svg: `<svg aria-label="${name}"></svg>`,
    ...overrides,
  };
}

function textValues(candidate: DesignElementCandidate): string[] {
  return candidate.elements
    .filter((element): element is TextElement => element.type === "text")
    .map((element) => element.runs.map((run) => run.text).join(""));
}

function sources(candidates: DesignElementCandidate[]): string[] {
  return candidates.map((candidate) => candidate.source).sort();
}

function candidateText(candidate: DesignElementCandidate): string {
  return textValues(candidate).join(" ").replace(/\s+/g, " ").trim();
}

function deckFromExampleElements(
  slideNumber: number,
  elementIndexes: number[],
): Deck {
  const sourceSlide = exampleDeck.slides[slideNumber - 1];
  if (!sourceSlide) throw new Error(`Missing example slide ${slideNumber}.`);
  return deck([
    {
      ...sourceSlide,
      elements: elementIndexes.map((index) => {
        const element = sourceSlide.elements[index];
        if (!element) {
          throw new Error(`Missing element ${index} on example slide ${slideNumber}.`);
        }
        return element;
      }),
    },
  ]);
}

describe("design element extraction", () => {
  describe("example imported deck", () => {
    it("uses the real PPTX-imported deck fixture as extraction data", () => {
      expect(exampleDeck.title).toBe("full-neon-presentation");
      expect(exampleDeck.slides).toHaveLength(19);

      const extraction = exampleExtraction();

      expect(extraction.metrics.rawCandidateCount).toBeGreaterThan(0);
      expect(extraction.metrics.candidateCount).toBeGreaterThan(0);
      expect(extraction.metrics.clusterCount).toBeGreaterThan(0);
      expect([...new Set(sources(extraction.candidates))]).toEqual(
        expect.arrayContaining(["container", "layout-grid", "media", "title-lockup"]),
      );
    });

    it("clusters the repeated brand pill from the real deck header", () => {
      const brandCluster = exampleExtraction().clusters.find((cluster) => {
        const occurrences = cluster.candidates.filter((candidate) =>
          candidateText(candidate).includes("Paucek and Lage"),
        );
        return occurrences.length >= 8;
      });

      expect(brandCluster).toBeDefined();
      expect(brandCluster?.candidates.length).toBeGreaterThanOrEqual(8);
      expect(brandCluster?.representative.elements.map((element) => element.type)).toEqual(
        expect.arrayContaining(["rectangle", "text"]),
      );
    });

    it("discovers the real agenda page as a grid of section labels and page numbers", () => {
      const agendaGrid = exampleExtraction().candidates.find(
        (candidate) =>
          candidate.source === "layout-grid" &&
          candidate.slideIndex === 1 &&
          candidateText(candidate).includes("TARGET AUDIENCE") &&
          candidateText(candidate).includes("CONTACT US") &&
          candidateText(candidate).includes("/19"),
      );

      expect(agendaGrid).toMatchObject({
        categoryHint: "content-card",
        intentHint: "insight-grid",
      });
      expect(agendaGrid?.elements).toHaveLength(10);
    });

    it("keeps the real competitor section as one reusable media grid", () => {
      const competitorGrid = exampleExtraction().candidates.find((candidate) => {
        const text = candidateText(candidate);
        return (
          candidate.source === "layout-grid" &&
          candidate.slideIndex === 14 &&
          text.includes("Competitor 01") &&
          text.includes("Competitor 02") &&
          text.includes("Competitor 03")
        );
      });

      expect(competitorGrid).toMatchObject({
        categoryHint: "media-card",
        intentHint: "insight-grid",
      });
      expect(competitorGrid?.elements.map((element) => element.type)).toEqual(
        expect.arrayContaining(["rectangle", "image", "text"]),
      );
    });
  });

  describe("candidate discovery", () => {
    it("discovers explicitly tagged consecutive elements as one candidate", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            text("Launch metric", { x: 1, y: 1, w: 2.2, h: 0.35 }, {}, {
              componentId: "imported-stat-card",
              componentInstanceId: "stat-card-1",
            }),
            text("42%", { x: 1, y: 1.45, w: 1.4, h: 0.4 }, { size: 28, bold: true }, {
              componentId: "imported-stat-card",
              componentInstanceId: "stat-card-1",
            }),
            text("Outside component", { x: 5, y: 1, w: 2, h: 0.35 }),
          ]),
        ]),
      );

      const explicit = extraction.candidates.find(
        (candidate) => candidate.source === "explicit",
      );

      expect(explicit).toMatchObject({
        label: "Stat Card",
        elementIndexes: [0, 1],
      });
      expect(textValues(explicit!)).toEqual(["Launch metric", "42%"]);
    });

    it("discovers a visible container shell with meaningful contents inside it", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            rectangle({ x: 1, y: 1, w: 3.2, h: 1.7 }),
            text("Customer Story", { x: 1.25, y: 1.25, w: 1.9, h: 0.35 }, {
              size: 20,
              bold: true,
            }),
            image("customer-photo", { x: 3.25, y: 1.2, w: 0.7, h: 0.7 }),
          ]),
        ]),
      );

      const container = extraction.candidates.find(
        (candidate) => candidate.source === "container",
      );

      expect(container?.elements.map((element) => element.type)).toEqual([
        "rectangle",
        "text",
        "image",
      ]);
      expect(container?.categoryHint).toBe("media-card");
    });

    it("discovers a grid layout even when there is no visible container shell", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            text("Speed", { x: 1, y: 1.45, w: 1.4, h: 0.3 }),
            text("Quality", { x: 3.2, y: 1.45, w: 1.4, h: 0.3 }),
            text("Trust", { x: 1, y: 2.45, w: 1.4, h: 0.3 }),
            text("Scale", { x: 3.2, y: 2.45, w: 1.4, h: 0.3 }),
          ]),
        ]),
      );

      const grid = extraction.candidates.find(
        (candidate) => candidate.source === "layout-grid",
      );

      expect(grid).toMatchObject({
        categoryHint: "content-card",
        intentHint: "insight-grid",
      });
      expect(textValues(grid!)).toEqual(["Speed", "Quality", "Trust", "Scale"]);
    });

    it("discovers standalone media assets but ignores full-slide background images", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            image("background-photo", { x: 0, y: 0, w: 10, h: 5.625 }),
            image("Reusable logo", { x: 1, y: 1, w: 1, h: 1 }),
          ]),
        ]),
      );

      const media = extraction.candidates.filter(
        (candidate) => candidate.source === "media",
      );

      expect(media).toHaveLength(1);
      expect(media[0]?.elements[0]).toMatchObject({
        type: "image",
        name: "Reusable logo",
      });
    });
  });

  describe("candidate repair and expansion", () => {
    it("repairs a tagged text fragment by pulling in its containing shell", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            rectangle({ x: 1, y: 1, w: 2.6, h: 0.9 }),
            text("Reusable card title", { x: 1.25, y: 1.25, w: 1.9, h: 0.32 }, {}, {
              componentId: "imported-reusable-card",
            }),
          ]),
        ]),
      );

      const repaired = extraction.candidates.find(
        (candidate) => candidate.source === "explicit",
      );

      expect(repaired?.elements.map((element) => element.type)).toEqual([
        "rectangle",
        "text",
      ]);
      expect(repaired?.key).toContain("repaired");
      expect(repaired?.quality.strengths).toContain("has a clear container or frame");
    });

    it("repairs a title lockup by adding nearby supporting body text", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            text("Q3 Highlights", { x: 1, y: 1, w: 2.6, h: 0.42 }, {
              size: 26,
              bold: true,
            }),
            line({ x: 1, y: 1.5, w: 1.2, h: 0.04 }),
            text(
              "Pipeline quality improved across every major segment this quarter.",
              { x: 1, y: 1.72, w: 3.4, h: 0.42 },
              { size: 13 },
            ),
          ]),
        ]),
      );

      const lockup = extraction.candidates.find(
        (candidate) => candidate.source === "title-lockup",
      );

      expect(lockup?.intentHint).toBe("title-lockup");
      expect(lockup?.elements.map((element) => element.type)).toEqual([
        "text",
        "line",
        "text",
      ]);
      expect(textValues(lockup!)).toContain(
        "Pipeline quality improved across every major segment this quarter.",
      );
    });

    it("repairs icon-like fragments by adding nearby labels", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            svgIcon("spark", { x: 1, y: 1, w: 0.32, h: 0.32 }, {
              componentId: "imported-icon-row",
            }),
            text("Fast setup", { x: 1.46, y: 0.98, w: 1.3, h: 0.32 }),
          ]),
        ]),
      );

      const repaired = extraction.candidates.find(
        (candidate) => candidate.source === "explicit",
      );

      expect(repaired?.elements.map((element) => element.type)).toEqual([
        "svg",
        "text",
      ]);
      expect(repaired?.slots.map((slot) => slot.kind)).toEqual(["icon", "label"]);
      expect(textValues(repaired!)).toEqual(["Fast setup"]);
    });
  });

  describe("overlap pruning", () => {
    it("keeps the richer higher-scoring candidate and removes its redundant overlap", () => {
      const extraction = createDesignElementExtraction(
        deck([
          slide([
            rectangle({ x: 1, y: 1, w: 2.6, h: 0.9 }),
            text("Reusable card title", { x: 1.25, y: 1.25, w: 1.9, h: 0.32 }, {}, {
              componentId: "imported-reusable-card",
            }),
          ]),
        ]),
      );

      expect(extraction.metrics.rawCandidateCount).toBeGreaterThan(
        extraction.metrics.candidateCount,
      );
      expect(extraction.candidates).toHaveLength(1);
      expect(sources(extraction.candidates)).toEqual(["explicit"]);
    });
  });

  describe("clustering and similarity", () => {
    it("clusters the same card pattern across slides even when the card is moved", () => {
      const firstCard = [
        rectangle({ x: 1, y: 1, w: 3.1, h: 1.25 }),
        text("Activation", { x: 1.25, y: 1.22, w: 1.8, h: 0.32 }, {
          size: 20,
          bold: true,
        }),
        text("Users finish onboarding faster.", { x: 1.25, y: 1.66, w: 2.35, h: 0.32 }, {
          size: 13,
        }),
      ];
      const movedCard = [
        rectangle({ x: 5.2, y: 2.2, w: 3.1, h: 1.25 }),
        text("Retention", { x: 5.45, y: 2.42, w: 1.8, h: 0.32 }, {
          size: 20,
          bold: true,
        }),
        text("Teams return every week.", { x: 5.45, y: 2.86, w: 2.35, h: 0.32 }, {
          size: 13,
        }),
      ];

      const extraction = createDesignElementExtraction(
        deck([slide(firstCard), slide(movedCard)]),
      );

      expect(extraction.candidates).toHaveLength(2);
      expect(extraction.clusters).toHaveLength(1);
      expect(extraction.clusters[0]?.candidates).toHaveLength(2);
      expect(extraction.clusters[0]?.description).toContain(
        "Found 2 times across slide(s) 1, 2.",
      );
    });

    it("clusters structurally similar cards even when their fuzzy signatures differ", () => {
      const acquisitionCard = [
        rectangle({ x: 1, y: 1, w: 3.1, h: 1.25 }),
        text("Acquisition", { x: 1.24, y: 1.22, w: 1.9, h: 0.3 }, {
          size: 20,
          bold: true,
        }),
        text("Paid channels convert faster.", { x: 1.24, y: 1.66, w: 2.3, h: 0.28 }, {
          size: 13,
        }),
      ];
      const expansionCard = [
        rectangle({ x: 5.1, y: 2.15, w: 3.35, h: 1.42 }, {
          fill: { color: "F1F5F9" },
        }),
        text("Expansion", { x: 5.42, y: 2.42, w: 2.15, h: 0.34 }, {
          size: 22,
          bold: true,
        }),
        text("Existing accounts adopt more seats.", { x: 5.42, y: 2.92, w: 2.55, h: 0.32 }, {
          size: 14,
        }),
      ];

      const extraction = createDesignElementExtraction(
        deck([slide(acquisitionCard), slide(expansionCard)]),
      );

      const cardCluster = extraction.clusters.find(
        (cluster) =>
          cluster.candidates.length === 2 &&
          cluster.candidates.every((candidate) => candidate.categoryHint === "title-lockup"),
      );

      expect(cardCluster).toBeDefined();
      expect(
        new Set(cardCluster?.candidates.map((candidate) => candidate.clusterSignature)),
      ).toHaveLength(2);
    });

    it("does not cluster different real image assets just because their imported name and geometry match", () => {
      const extraction = createDesignElementExtraction(
        deck([
          ...deckFromExampleElements(3, [8]).slides,
          ...deckFromExampleElements(12, [7]).slides,
        ]),
      );

      expect(extraction.candidates).toHaveLength(2);
      expect(extraction.clusters).toHaveLength(2);
      expect(extraction.candidates.map((candidate) => candidate.label)).toEqual([
        "Image: Image 2",
        "Image: Image 2",
      ]);
    });
  });
});
