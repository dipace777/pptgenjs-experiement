import {
  SLIDE_H,
  SLIDE_W,
  type Deck,
  type Slide,
  type SlideElement,
} from "./slide-schema";
import {
  averageBorderRadius,
  chartColor,
  elementBox,
  elementFont,
  fillColor,
  strokeColor,
  textContent,
  textListStrings,
} from "./element-model";

export type ExtractedDesignElementTemplate = {
  id: string;
  label: string;
  description?: string;
  elements: SlideElement[];
};

type Candidate = {
  key: string;
  label: string;
  description: string;
  elements: SlideElement[];
  score: number;
  signature: string;
};

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const SLIDE_AREA = SLIDE_W * SLIDE_H;
const MAX_TEMPLATES = 32;
const MAX_ELEMENTS_PER_TEMPLATE = 12;
const MIN_GROUP_AREA = SLIDE_AREA * 0.006;
const MAX_GROUP_AREA = SLIDE_AREA * 0.45;

export function extractDesignElementTemplates(
  deck: Deck,
  limit = MAX_TEMPLATES,
): ExtractedDesignElementTemplate[] {
  const candidates = [
    ...explicitComponentCandidates(deck),
    ...containerGroupCandidates(deck),
    ...titleLockupCandidates(deck),
    ...mediaCandidates(deck),
  ].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const seenSignatures = new Set<string>();
  const usedIds = new Set<string>();
  const templates: ExtractedDesignElementTemplate[] = [];

  for (const candidate of candidates) {
    if (candidate.elements.length === 0) continue;
    if (seenSignatures.has(candidate.signature)) continue;
    seenSignatures.add(candidate.signature);

    const id = uniqueTemplateId(candidate.key, usedIds);
    const description = truncate(candidate.description, 600);
    templates.push({
      id,
      label: truncate(candidate.label, 90),
      description,
      elements: withTemplateMetadata(candidate.elements, id, description),
    });

    if (templates.length >= limit) break;
  }

  return templates;
}

function explicitComponentCandidates(deck: Deck): Candidate[] {
  const candidates: Candidate[] = [];

  deck.slides.forEach((slide, slideIndex) => {
    let index = 0;
    while (index < slide.elements.length) {
      const first = slide.elements[index];
      const componentId = first?.componentId;
      if (!componentId) {
        index += 1;
        continue;
      }

      const componentInstanceId = first.componentInstanceId;
      const start = index;
      index += 1;
      while (index < slide.elements.length) {
        const next = slide.elements[index];
        if (!next || next.componentId !== componentId) break;
        if (componentInstanceId) {
          if (next.componentInstanceId !== componentInstanceId) break;
        } else if (next.componentInstanceId) {
          break;
        }
        index += 1;
      }

      const elements = slide.elements.slice(start, index);
      if (elements.length === 0) continue;
      const label = labelFromComponentId(componentId);
      candidates.push({
        key: `imported-${componentId}`,
        label,
        description: `Recovered component from imported slide ${slideIndex + 1}.`,
        elements,
        score: 1_000 + elements.length * 12,
        signature: `explicit:${componentId}:${layoutSignature(elements)}`,
      });
    }
  });

  return candidates;
}

function containerGroupCandidates(deck: Deck): Candidate[] {
  const candidates: Candidate[] = [];

  deck.slides.forEach((slide, slideIndex) => {
    slide.elements.forEach((container, containerIndex) => {
      if (!isContainerElement(container, slide)) return;

      const containerBounds = padBounds(elementBounds(container), 0.06);
      const members = slide.elements
        .map((element, index) => ({ element, index }))
        .filter(({ element, index }) => {
          if (index === containerIndex) return true;
          if (isLikelyBackgroundElement(element, slide)) return false;
          return elementFitsWithin(element, containerBounds);
        })
        .slice(0, MAX_ELEMENTS_PER_TEMPLATE)
        .sort((a, b) => a.index - b.index);

      const elements = members.map(({ element }) => element);
      if (elements.length < 2) return;
      if (!elements.some((element) => element.type === "text" || element.type === "image")) {
        return;
      }

      const label = labelFromElements(elements, "Design Block");
      candidates.push({
        key: `imported-block-${slideIndex + 1}-${containerIndex + 1}`,
        label,
        description: `Grouped design block extracted from imported slide ${slideIndex + 1}.`,
        elements,
        score: 700 + elements.length * 10 - elementArea(container),
        signature: `block:${layoutSignature(elements)}`,
      });
    });
  });

  return candidates;
}

function titleLockupCandidates(deck: Deck): Candidate[] {
  const candidates: Candidate[] = [];

  deck.slides.forEach((slide, slideIndex) => {
    slide.elements.forEach((element, elementIndex) => {
      if (element.type !== "text") return;
      if (!isHeadingText(element)) return;

      const accents = slide.elements
        .map((candidate, index) => ({ element: candidate, index }))
        .filter(({ element: candidate, index }) => {
          if (index === elementIndex) return false;
          return isNearbyAccent(candidate, element);
        })
        .slice(0, 3);

      if (accents.length === 0) return;
      const elements = [
        { element, index: elementIndex },
        ...accents,
      ]
        .sort((a, b) => a.index - b.index)
        .map(({ element: item }) => item);

      candidates.push({
        key: `imported-title-${slideIndex + 1}-${elementIndex + 1}`,
        label: labelFromElements(elements, "Title Lockup"),
        description: `Title lockup extracted from imported slide ${slideIndex + 1}.`,
        elements,
        score: 560 + accents.length * 12,
        signature: `title:${layoutSignature(elements)}`,
      });
    });
  });

  return candidates;
}

function mediaCandidates(deck: Deck): Candidate[] {
  const candidates: Candidate[] = [];

  deck.slides.forEach((slide, slideIndex) => {
    slide.elements.forEach((element, elementIndex) => {
      if (element.type !== "image") return;
      if (isLikelyBackgroundElement(element, slide)) return;
      const area = elementArea(element);
      if (area < SLIDE_AREA * 0.01 || area > SLIDE_AREA * 0.5) return;

      const label = element.name?.trim()
        ? `Image: ${truncate(element.name.trim(), 48)}`
        : "Image Asset";
      candidates.push({
        key: `imported-image-${slideIndex + 1}-${elementIndex + 1}`,
        label,
        description: `Image asset extracted from imported slide ${slideIndex + 1}.`,
        elements: [element],
        score: 360 + Math.min(80, area * 5),
        signature: `image:${imageIdentity(element)}:${roundForSignature(elementBounds(element).w)}x${roundForSignature(elementBounds(element).h)}`,
      });
    });
  });

  return candidates;
}

function withTemplateMetadata(
  elements: SlideElement[],
  componentId: string,
  description: string,
): SlideElement[] {
  return elements.map((element) => {
    const copy = cloneElement(element);
    copy.componentId = componentId;
    delete copy.componentInstanceId;
    copy.componentDescription = description;
    return copy;
  });
}

function isContainerElement(element: SlideElement, slide: Slide): boolean {
  if (element.type !== "rectangle" && element.type !== "ellipse") return false;
  if (element.opacity === 0) return false;
  if (isLikelyBackgroundElement(element, slide)) return false;

  const area = elementArea(element);
  const box = elementBounds(element);
  if (area < MIN_GROUP_AREA || area > MAX_GROUP_AREA) return false;
  if (box.w < 0.2 || box.h < 0.16) return false;

  if (
    element.type === "rectangle" &&
    sameColor(element.fill?.color, slide.background) &&
    !element.stroke &&
    !element.shadow &&
    area > SLIDE_AREA * 0.12
  ) {
    return false;
  }

  return true;
}

function isLikelyBackgroundElement(element: SlideElement, slide: Slide): boolean {
  const area = elementArea(element);
  const box = elementBounds(element);
  if (area < SLIDE_AREA * 0.72) return false;
  if (box.x > 0.2 || box.y > 0.2) return false;
  if (box.w < SLIDE_W * 0.85 || box.h < SLIDE_H * 0.85) return false;
  if (element.type === "rectangle" && sameColor(element.fill?.color, slide.background)) return true;
  return element.type === "image";
}

function isHeadingText(element: Extract<SlideElement, { type: "text" }>): boolean {
  const text = textContent(element).trim();
  const box = elementBounds(element);
  const font = elementFont(element);
  if (text.length < 2 || text.length > 140) return false;
  if (box.w < 1.4 || box.h > 1.4) return false;
  return font.size >= 22 || (font.bold === true && font.size >= 16);
}

function isNearbyAccent(candidate: SlideElement, heading: SlideElement): boolean {
  if (candidate.type !== "rectangle" && candidate.type !== "ellipse" && candidate.type !== "image") {
    return false;
  }
  if (candidate.opacity === 0) return false;
  const candidateBox = elementBounds(candidate);
  const headingBox = elementBounds(heading);

  const horizontalOverlap =
    Math.min(headingBox.x + headingBox.w, candidateBox.x + candidateBox.w) -
    Math.max(headingBox.x, candidateBox.x);
  const closeHorizontally = horizontalOverlap > 0 || Math.abs(candidateBox.x - headingBox.x) < 0.35;
  const closeVertically =
    candidateBox.y >= headingBox.y - 0.18 && candidateBox.y <= headingBox.y + headingBox.h + 0.45;
  const accentSized =
    candidateBox.h <= 0.16 ||
    candidateBox.w <= 0.16 ||
    (candidateBox.w <= 0.8 && candidateBox.h <= 0.8);

  return closeHorizontally && closeVertically && accentSized;
}

function elementFitsWithin(element: SlideElement, bounds: Bounds): boolean {
  const elementBox = elementBounds(element);
  const centerX = elementBox.x + elementBox.w / 2;
  const centerY = elementBox.y + elementBox.h / 2;
  const centerInside =
    centerX >= bounds.x &&
    centerX <= bounds.x + bounds.w &&
    centerY >= bounds.y &&
    centerY <= bounds.y + bounds.h;
  if (centerInside) return true;

  const overlap = intersectionArea(elementBox, bounds);
  return overlap / Math.max(0.01, elementBox.w * elementBox.h) >= 0.72;
}

function labelFromComponentId(componentId: string): string {
  return componentId
    .replace(/^imported[-_]?/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelFromElements(elements: SlideElement[], fallback: string): string {
  const text = elements.find(
    (element): element is Extract<SlideElement, { type: "text" }> =>
      element.type === "text" && textContent(element).trim().length > 0,
  );
  if (text) return `${fallback}: ${truncate(oneLine(textContent(text)), 42)}`;

  const image = elements.find(
    (element): element is Extract<SlideElement, { type: "image" }> =>
      element.type === "image" && !!element.name?.trim(),
  );
  if (image?.name) return `${fallback}: ${truncate(image.name.trim(), 42)}`;

  return fallback;
}

function layoutSignature(elements: SlideElement[]): string {
  const bounds = boundsForElements(elements);
  return elements
    .map((element) => {
      const box = elementBounds(element);
      const relX = roundForSignature(box.x - bounds.x);
      const relY = roundForSignature(box.y - bounds.y);
      return [
        element.type,
        relX,
        relY,
        roundForSignature(box.w),
        roundForSignature(box.h),
        styleSignature(element),
      ].join(":");
    })
    .join("|");
}

function styleSignature(element: SlideElement): string {
  if (element.type === "text") {
    const font = elementFont(element);
    return [
      font.family,
      Math.round(font.size / 4) * 4,
      font.bold ? "b" : "",
      normalizeColor(font.color),
      element.alignment?.horizontal ?? "",
      Math.ceil(textContent(element).trim().length / 20),
    ].join(",");
  }
  if (element.type === "rectangle") {
    return [
      normalizeColor(fillColor(element.fill, "")),
      element.stroke?.color ? normalizeColor(strokeColor(element.stroke)) : "",
      element.borderRadius ? roundForSignature(averageBorderRadius(element.borderRadius)) : "",
    ].join(",");
  }
  if (element.type === "ellipse") {
    return normalizeColor(fillColor(element.fill, ""));
  }
  if (element.type === "image") {
    return [element.fit ?? "", element.name ?? ""].join(",");
  }
  if (element.type === "table") {
    return [
      normalizeColor(fillColor(element.columns[0]?.fill, "")),
      normalizeColor(strokeColor(element.columns[0]?.stroke, "")),
    ].join(",");
  }
  if (element.type === "chart") {
    return [element.chartType, normalizeColor(chartColor(element))].join(",");
  }
  if (element.type === "text-list") {
    return [normalizeColor(elementFont(element).color), textListStrings(element).length].join(",");
  }
  return "name" in element ? element.name ?? "" : "";
}

function imageIdentity(element: Extract<SlideElement, { type: "image" }>): string {
  if (element.name?.trim()) return `name-${slugify(element.name)}`;
  if (element.data) return `data-${sampleHash(element.data)}`;
  return "empty";
}

function boundsForElements(elements: SlideElement[]): Bounds {
  const boxes = elements.map(elementBounds);
  const minX = Math.min(...boxes.map((box) => box.x));
  const minY = Math.min(...boxes.map((box) => box.y));
  const maxX = Math.max(...boxes.map((box) => box.x + box.w));
  const maxY = Math.max(...boxes.map((box) => box.y + box.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function elementBounds(element: SlideElement): Bounds {
  return elementBox(element);
}

function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: bounds.w + padding * 2,
    h: bounds.h + padding * 2,
  };
}

function elementArea(element: SlideElement): number {
  const box = elementBounds(element);
  return box.w * box.h;
}

function intersectionArea(a: Bounds, b: Bounds): number {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return w * h;
}

function uniqueTemplateId(key: string, usedIds: Set<string>): string {
  const base = truncate(slugify(key) || "imported-design-element", 112);
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = truncate(`${base}-${suffix}`, 120);
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, Math.max(0, max - 1)).trimEnd() : value;
}

function roundForSignature(value: number): number {
  return Math.round(value * 20) / 20;
}

function sameColor(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeColor(a) === normalizeColor(b);
}

function normalizeColor(value: string | null | undefined): string {
  return (value ?? "").replace("#", "").toUpperCase();
}

function sampleHash(value: string): string {
  let hash = 0;
  const step = Math.max(1, Math.floor(value.length / 160));
  for (let index = 0; index < value.length; index += step) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function cloneElement(element: SlideElement): SlideElement {
  return JSON.parse(JSON.stringify(element)) as SlideElement;
}
