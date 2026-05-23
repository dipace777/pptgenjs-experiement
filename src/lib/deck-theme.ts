import type { Deck, SlideElement, ThemeRole } from "./slide-schema";

export type DeckTheme = Record<ThemeRole, string>;

export const DEFAULT_DECK_THEME: DeckTheme = {
  background: "F4F6FA",
  surface: "FFFFFF",
  primary: "0B1F3A",
  secondary: "3E78B2",
  accent: "D4A24C",
  text: "1A2B45",
  muted: "6A7894",
};

export function resolveDeckTheme(deck: Deck): DeckTheme {
  const raw = deck.theme;
  if (!raw) return { ...DEFAULT_DECK_THEME };
  return {
    background: raw.background ?? DEFAULT_DECK_THEME.background,
    surface: raw.surface ?? DEFAULT_DECK_THEME.surface,
    primary: raw.primary ?? DEFAULT_DECK_THEME.primary,
    secondary: raw.secondary ?? DEFAULT_DECK_THEME.secondary,
    accent: raw.accent ?? DEFAULT_DECK_THEME.accent,
    text: raw.text ?? DEFAULT_DECK_THEME.text,
    muted: raw.muted ?? DEFAULT_DECK_THEME.muted,
  };
}

export function applyDeckTheme(deck: Deck, nextTheme: DeckTheme): void {
  const currentTheme = resolveDeckTheme(deck);
  const colorMap = new Map(
    (Object.keys(nextTheme) as ThemeRole[])
      .filter((key) => currentTheme[key] !== nextTheme[key])
      .map((key) => [currentTheme[key].toUpperCase(), nextTheme[key].toUpperCase()]),
  );

  deck.theme = nextTheme;
  if (colorMap.size === 0) return;

  for (const slide of deck.slides) {
    slide.background = themedColor(
      slide.background,
      slide.backgroundRole,
      nextTheme,
      colorMap,
    );
    for (const element of slide.elements) applyElementTheme(element, nextTheme, colorMap);
  }
}

function applyElementTheme(
  element: SlideElement,
  theme: DeckTheme,
  colorMap: Map<string, string>,
): void {
  if (element.kind === "text") {
    element.color = themedColor(element.color, element.colorRole, theme, colorMap);
    return;
  }

  if (element.kind === "rect" || element.kind === "ellipse") {
    element.fill = themedColor(element.fill, element.fillRole, theme, colorMap);
    if (element.line) {
      element.line.color = themedColor(
        element.line.color,
        element.line.colorRole,
        theme,
        colorMap,
      );
    }
    return;
  }

  if (element.kind === "bullets") {
    element.color = themedColor(element.color, element.colorRole, theme, colorMap);
    if (element.bulletColor) {
      element.bulletColor = themedColor(
        element.bulletColor,
        element.bulletColorRole,
        theme,
        colorMap,
      );
    }
    return;
  }

  if (element.kind === "chart") {
    element.color = themedColor(element.color, element.colorRole, theme, colorMap);
    if (element.axisColor) {
      element.axisColor = themedColor(
        element.axisColor,
        element.axisColorRole,
        theme,
        colorMap,
      );
    }
    if (element.labelColor) {
      element.labelColor = themedColor(
        element.labelColor,
        element.labelColorRole,
        theme,
        colorMap,
      );
    }
    element.data.forEach((datum) => {
      if (datum.color) {
        datum.color = themedColor(datum.color, datum.colorRole, theme, colorMap);
      }
    });
    return;
  }

  if (element.kind === "table") {
    element.textColor = themedColor(
      element.textColor,
      element.textColorRole,
      theme,
      colorMap,
    );
    element.headerFill = themedColor(
      element.headerFill,
      element.headerFillRole,
      theme,
      colorMap,
    );
    element.headerTextColor = themedColor(
      element.headerTextColor,
      element.headerTextColorRole,
      theme,
      colorMap,
    );
    element.borderColor = themedColor(
      element.borderColor,
      element.borderColorRole,
      theme,
      colorMap,
    );
    if (element.fill) {
      element.fill = themedColor(element.fill, element.fillRole, theme, colorMap);
    }
    return;
  }

  if (element.kind === "svg") {
    element.svg = mapSvgColors(element.svg, colorMap);
  }
}

function themedColor(
  color: string,
  role: ThemeRole | null | undefined,
  theme: DeckTheme,
  colorMap: Map<string, string>,
): string {
  if (role) return theme[role];
  return mapColor(color, colorMap);
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
