import type { Deck, SlideElement } from "./slide-schema";

export type DeckTheme = {
  background: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
};

export const DEFAULT_DECK_THEME: DeckTheme = {
  background: "F4F6FA",
  primary: "0B1F3A",
  secondary: "3E78B2",
  accent: "D4A24C",
  text: "1A2B45",
};

export function resolveDeckTheme(deck: Deck): DeckTheme {
  return { ...DEFAULT_DECK_THEME, ...deck.theme };
}

export function applyDeckTheme(deck: Deck, nextTheme: DeckTheme): void {
  const currentTheme = resolveDeckTheme(deck);
  const colorMap = new Map(
    (Object.keys(nextTheme) as Array<keyof DeckTheme>)
      .filter((key) => currentTheme[key] !== nextTheme[key])
      .map((key) => [currentTheme[key].toUpperCase(), nextTheme[key].toUpperCase()]),
  );

  deck.theme = nextTheme;
  if (colorMap.size === 0) return;

  for (const slide of deck.slides) {
    slide.background = mapColor(slide.background, colorMap);
    for (const element of slide.elements) applyElementTheme(element, colorMap);
  }
}

function applyElementTheme(
  element: SlideElement,
  colorMap: Map<string, string>,
): void {
  if (element.kind === "text") {
    element.color = mapColor(element.color, colorMap);
    return;
  }

  if (element.kind === "rect" || element.kind === "ellipse") {
    element.fill = mapColor(element.fill, colorMap);
    if (element.line) element.line.color = mapColor(element.line.color, colorMap);
    return;
  }

  if (element.kind === "bullets") {
    element.color = mapColor(element.color, colorMap);
    if (element.bulletColor) {
      element.bulletColor = mapColor(element.bulletColor, colorMap);
    }
    return;
  }

  if (element.kind === "chart") {
    element.color = mapColor(element.color, colorMap);
    if (element.axisColor) element.axisColor = mapColor(element.axisColor, colorMap);
    if (element.labelColor) element.labelColor = mapColor(element.labelColor, colorMap);
    element.data.forEach((datum) => {
      if (datum.color) datum.color = mapColor(datum.color, colorMap);
    });
    return;
  }

  if (element.kind === "table") {
    element.textColor = mapColor(element.textColor, colorMap);
    element.headerFill = mapColor(element.headerFill, colorMap);
    element.headerTextColor = mapColor(element.headerTextColor, colorMap);
    element.borderColor = mapColor(element.borderColor, colorMap);
    if (element.fill) element.fill = mapColor(element.fill, colorMap);
    return;
  }

  if (element.kind === "svg") {
    element.svg = mapSvgColors(element.svg, colorMap);
  }
}

function mapColor(color: string, colorMap: Map<string, string>): string {
  const normalized = color.replace("#", "").toUpperCase();
  return colorMap.get(normalized) ?? color;
}

function mapSvgColors(svg: string, colorMap: Map<string, string>): string {
  let next = svg;
  for (const [from, to] of colorMap) {
    next = next.replace(new RegExp(`#${from}\\b`, "gi"), `#${to}`);
  }
  return next;
}
