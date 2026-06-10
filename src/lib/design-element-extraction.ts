import { z } from "zod";
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

const SLIDE_AREA = SLIDE_W * SLIDE_H;
const MAX_TEMPLATES = 32;
const MAX_ELEMENTS_PER_TEMPLATE = 12;
const MAX_LLM_CLUSTERS = 60;
const MIN_GROUP_AREA = SLIDE_AREA * 0.006;
const MAX_GROUP_AREA = SLIDE_AREA * 0.45;

export const DesignElementCategorySchema = z.enum([
  "navigation",
  "badge",
  "title-lockup",
  "content-card",
  "media-card",
  "stat-card",
  "cta",
  "image-asset",
  "divider",
  "decorative",
  "unknown",
]);

export type DesignElementCategory = z.infer<typeof DesignElementCategorySchema>;

export const DesignElementStructureSchema = z.enum([
  "group",
  "container",
  "flex",
  "grid",
]);

export type DesignElementStructure = z.infer<
  typeof DesignElementStructureSchema
>;

const CurationBoundsSchema = z
  .object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  })
  .strict();

const CurationElementSummarySchema = z
  .object({
    type: z.string().min(1).max(40),
    role: z.string().min(1).max(80),
    bounds: CurationBoundsSchema,
    style: z.array(z.string().min(1).max(120)).max(12),
    text: z.string().max(140).optional(),
  })
  .strict();

export const DesignElementCurationClusterSchema = z
  .object({
    id: z.string().min(1).max(140),
    representativeCandidateId: z.string().min(1).max(140),
    label: z.string().min(1).max(120),
    description: z.string().max(600),
    categoryHint: DesignElementCategorySchema,
    recommendedStructure: DesignElementStructureSchema,
    score: z.number(),
    occurrenceCount: z.number().int().min(1).max(100),
    slideNumbers: z.array(z.number().int().min(1).max(200)).max(40),
    bounds: CurationBoundsSchema,
    elements: z.array(CurationElementSummarySchema).max(MAX_ELEMENTS_PER_TEMPLATE),
  })
  .strict();

export const DesignElementCurationInputSchema = z
  .object({
    deckTitle: z.string().min(1).max(120),
    slideCount: z.number().int().min(1).max(100),
    clusters: z.array(DesignElementCurationClusterSchema).max(80),
  })
  .strict();

export const DesignElementCurationDecisionSchema = z
  .object({
    clusterId: z.string().min(1).max(140),
    action: z.enum(["keep", "drop"]),
    category: DesignElementCategorySchema,
    label: z.string().min(1).max(90),
    description: z.string().min(1).max(220),
    representativeCandidateId: z.string().min(1).max(140).optional(),
    structure: DesignElementStructureSchema.nullish(),
    confidence: z.number().min(0).max(1),
  })
  .strict();

export const DesignElementCurationModelOutputSchema = z
  .object({
    decisions: z.array(DesignElementCurationDecisionSchema).max(MAX_TEMPLATES),
  })
  .strict();

export const DesignElementCurationOutputSchema =
  DesignElementCurationModelOutputSchema.extend({
    source: z.enum(["ai", "fallback", "disabled", "empty"]).optional(),
    message: z.string().max(300).optional(),
  });

export type DesignElementCurationInput = z.infer<
  typeof DesignElementCurationInputSchema
>;
export type DesignElementCurationOutput = z.infer<
  typeof DesignElementCurationOutputSchema
>;

export type DesignElementCandidate = Candidate;

export type DesignElementCandidateCluster = {
  id: string;
  categoryHint: DesignElementCategory;
  label: string;
  description: string;
  representative: Candidate;
  candidates: Candidate[];
  score: number;
  signature: string;
};

export type DesignElementExtraction = {
  templates: ExtractedDesignElementTemplate[];
  candidates: Candidate[];
  clusters: DesignElementCandidateCluster[];
  curationInput: DesignElementCurationInput;
  metrics: {
    rawCandidateCount: number;
    candidateCount: number;
    clusterCount: number;
  };
};

type Candidate = {
  id: string;
  key: string;
  label: string;
  description: string;
  elements: SlideElement[];
  source: "explicit" | "container" | "title-lockup" | "media";
  slideIndex: number;
  elementIndexes: number[];
  categoryHint: DesignElementCategory;
  bounds: Bounds;
  score: number;
  signature: string;
  clusterSignature: string;
};

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export function extractDesignElementTemplates(
  deck: Deck,
  limit = MAX_TEMPLATES,
): ExtractedDesignElementTemplate[] {
  return createDesignElementExtraction(deck, limit).templates;
}

export function createDesignElementExtraction(
  deck: Deck,
  limit = MAX_TEMPLATES,
): DesignElementExtraction {
  const rawCandidates = [
    ...explicitComponentCandidates(deck),
    ...containerGroupCandidates(deck),
    ...titleLockupCandidates(deck),
    ...mediaCandidates(deck),
  ].sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const candidates = pruneOverlappingCandidates(rawCandidates);
  const clusters = clusterCandidates(candidates).sort(
    (a, b) => b.score - a.score || a.label.localeCompare(b.label),
  );

  return {
    templates: templatesFromClusters(clusters, limit),
    candidates,
    clusters,
    curationInput: buildCurationInput(deck, clusters),
    metrics: {
      rawCandidateCount: rawCandidates.length,
      candidateCount: candidates.length,
      clusterCount: clusters.length,
    },
  };
}

export function templatesFromDesignElementCuration(
  extraction: DesignElementExtraction,
  curation: DesignElementCurationOutput,
  limit = MAX_TEMPLATES,
): ExtractedDesignElementTemplate[] {
  const clustersById = new Map(
    extraction.clusters.map((cluster) => [cluster.id, cluster]),
  );
  const dropped = new Set(
    curation.decisions
      .filter((decision) => decision.action === "drop")
      .map((decision) => decision.clusterId),
  );
  const orderedClusters: Array<{
    cluster: DesignElementCandidateCluster;
    label?: string;
    description?: string;
    representativeCandidateId?: string;
    structure?: DesignElementStructure;
    confidence: number;
  }> = [];

  for (const decision of curation.decisions) {
    if (decision.action !== "keep") continue;
    const cluster = clustersById.get(decision.clusterId);
    if (!cluster || decision.confidence < 0.35) continue;
    orderedClusters.push({
      cluster,
      label: decision.label,
      description: decision.description,
      representativeCandidateId: decision.representativeCandidateId,
      structure: decision.structure ?? undefined,
      confidence: decision.confidence,
    });
  }

  orderedClusters.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.cluster.score - a.cluster.score ||
      a.cluster.label.localeCompare(b.cluster.label),
  );

  const selected = new Set<string>();
  const templates = templatesFromClusterSelections(orderedClusters, limit, selected);

  if (templates.length >= limit) return templates;

  const fallbackSelections = extraction.clusters
    .filter((cluster) => !selected.has(cluster.id) && !dropped.has(cluster.id))
    .map((cluster) => ({ cluster, confidence: 0 }));

  return [
    ...templates,
    ...templatesFromClusterSelections(
      fallbackSelections,
      limit - templates.length,
      selected,
    ),
  ].slice(0, limit);
}

function templatesFromClusters(
  clusters: DesignElementCandidateCluster[],
  limit: number,
): ExtractedDesignElementTemplate[] {
  return templatesFromClusterSelections(
    clusters.map((cluster) => ({ cluster, confidence: 0 })),
    limit,
    new Set<string>(),
  );
}

function templatesFromClusterSelections(
  selections: Array<{
    cluster: DesignElementCandidateCluster;
    label?: string;
    description?: string;
    representativeCandidateId?: string;
    structure?: DesignElementStructure;
    confidence: number;
  }>,
  limit: number,
  selected: Set<string>,
): ExtractedDesignElementTemplate[] {
  const usedIds = new Set<string>();
  const templates: ExtractedDesignElementTemplate[] = [];

  for (const selection of selections) {
    const { cluster } = selection;
    if (selected.has(cluster.id)) continue;
    const candidate =
      cluster.candidates.find(
        (item) => item.id === selection.representativeCandidateId,
      ) ?? cluster.representative;
    if (candidate.elements.length === 0) continue;

    const id = uniqueTemplateId(candidate.key, usedIds);
    const description = truncate(
      selection.description ?? cluster.description,
      600,
    );
    templates.push({
      id,
      label: truncate(selection.label ?? cluster.label, 90),
      description,
      elements: templateElementsForCandidate(
        candidate,
        id,
        description,
        selection.structure,
      ),
    });
    selected.add(cluster.id);

    if (templates.length >= limit) break;
  }

  return templates;
}

function makeCandidate(input: Omit<Candidate, "id" | "bounds" | "clusterSignature">): Candidate {
  const bounds = boundsForElements(input.elements);
  return {
    ...input,
    id: candidateId(input.source, input.slideIndex, input.elementIndexes, input.key),
    bounds,
    clusterSignature: fuzzyLayoutSignature(input.elements, input.categoryHint),
  };
}

function pruneOverlappingCandidates(candidates: Candidate[]): Candidate[] {
  const accepted: Candidate[] = [];
  const seenExact = new Set<string>();

  for (const candidate of candidates) {
    const exactKey = `${candidate.signature}:${candidate.slideIndex}:${candidate.elementIndexes.join(",")}`;
    if (seenExact.has(exactKey)) continue;
    seenExact.add(exactKey);

    const redundant = accepted.some((existing) => {
      if (existing.slideIndex !== candidate.slideIndex) return false;
      const overlap = intersectionArea(existing.bounds, candidate.bounds);
      const smallerArea = Math.min(
        existing.bounds.w * existing.bounds.h,
        candidate.bounds.w * candidate.bounds.h,
      );
      const elementOverlap = indexJaccard(
        existing.elementIndexes,
        candidate.elementIndexes,
      );
      const spatiallyNested = overlap / Math.max(0.01, smallerArea) >= 0.82;
      const sameFamily =
        existing.categoryHint === candidate.categoryHint ||
        elementTypeSequence(existing.elements) === elementTypeSequence(candidate.elements);

      return (
        sameFamily &&
        (elementOverlap >= 0.62 || spatiallyNested) &&
        existing.score >= candidate.score - 80
      );
    });

    if (!redundant) accepted.push(candidate);
  }

  return accepted;
}

function clusterCandidates(candidates: Candidate[]): DesignElementCandidateCluster[] {
  const clusters: DesignElementCandidateCluster[] = [];

  for (const candidate of candidates) {
    const best = bestClusterForCandidate(candidate, clusters);
    if (best && best.similarity >= 0.78) {
      best.cluster.candidates.push(candidate);
      if (candidate.score > best.cluster.representative.score) {
        best.cluster.representative = candidate;
        best.cluster.label = candidate.label;
        best.cluster.description = candidate.description;
      }
      best.cluster.score = clusterScore(best.cluster);
      continue;
    }

    clusters.push({
      id: uniqueClusterId(candidate, clusters),
      categoryHint: candidate.categoryHint,
      label: candidate.label,
      description: candidate.description,
      representative: candidate,
      candidates: [candidate],
      score: candidate.score,
      signature: candidate.clusterSignature,
    });
  }

  for (const cluster of clusters) {
    cluster.score = clusterScore(cluster);
    cluster.label = labelForCluster(cluster);
    cluster.description = descriptionForCluster(cluster);
  }

  return clusters;
}

function bestClusterForCandidate(
  candidate: Candidate,
  clusters: DesignElementCandidateCluster[],
) {
  let best:
    | { cluster: DesignElementCandidateCluster; similarity: number }
    | null = null;

  for (const cluster of clusters) {
    const similarity = candidateSimilarity(candidate, cluster.representative);
    if (!best || similarity > best.similarity) {
      best = { cluster, similarity };
    }
  }

  return best;
}

function candidateSimilarity(a: Candidate, b: Candidate): number {
  if (a.clusterSignature === b.clusterSignature) return 1;
  if (
    a.categoryHint === "image-asset" &&
    b.categoryHint === "image-asset" &&
    firstImageIdentity(a.elements) !== firstImageIdentity(b.elements)
  ) {
    return 0.25;
  }

  let score = 0;
  if (a.categoryHint === b.categoryHint) score += 0.18;
  else if (compatibleCategories(a.categoryHint, b.categoryHint)) score += 0.08;

  const aTypes = elementTypeSequence(a.elements);
  const bTypes = elementTypeSequence(b.elements);
  if (aTypes === bTypes) score += 0.24;
  else score += jaccard(aTypes.split(">"), bTypes.split(">")) * 0.12;

  score += jaccard(layoutTokens(a.elements), layoutTokens(b.elements)) * 0.32;
  score += jaccard(styleTokensForElements(a.elements), styleTokensForElements(b.elements)) * 0.16;
  score += sizeSimilarity(a.bounds, b.bounds) * 0.1;

  return score;
}

function clusterScore(cluster: DesignElementCandidateCluster): number {
  const representativeScore = cluster.representative.score;
  const occurrenceBonus = Math.min(260, (cluster.candidates.length - 1) * 55);
  const slideBonus = Math.min(180, (uniqueSlideIndexes(cluster).length - 1) * 45);
  const categoryBonus = categoryScoreBonus(cluster.categoryHint);
  return representativeScore + occurrenceBonus + slideBonus + categoryBonus;
}

function labelForCluster(cluster: DesignElementCandidateCluster): string {
  const categoryLabel = categoryDisplayName(cluster.categoryHint);
  const bestText = cluster.candidates
    .flatMap((candidate) => candidate.elements)
    .find(
      (element): element is Extract<SlideElement, { type: "text" }> =>
        element.type === "text" && textContent(element).trim().length > 0,
    );
  if (!bestText) return categoryLabel;

  const text = truncate(oneLine(textContent(bestText)), 38);
  if (cluster.categoryHint === "navigation" || cluster.categoryHint === "badge") {
    return `${categoryLabel}: ${text}`;
  }
  if (cluster.categoryHint === "image-asset") return cluster.representative.label;
  return `${categoryLabel}: ${text}`;
}

function descriptionForCluster(cluster: DesignElementCandidateCluster): string {
  const slides = uniqueSlideIndexes(cluster).map((index) => index + 1);
  const occurrenceText =
    cluster.candidates.length === 1
      ? `Found on slide ${slides[0]}.`
      : `Found ${cluster.candidates.length} times across slide(s) ${slides.join(", ")}.`;
  return `${categoryDisplayName(cluster.categoryHint)} extracted from imported deck. ${occurrenceText}`;
}

function buildCurationInput(
  deck: Deck,
  clusters: DesignElementCandidateCluster[],
): DesignElementCurationInput {
  const value = {
    deckTitle: deck.title,
    slideCount: deck.slides.length,
    clusters: clusters.slice(0, MAX_LLM_CLUSTERS).map(clusterSummary),
  };
  return DesignElementCurationInputSchema.parse(value);
}

function clusterSummary(cluster: DesignElementCandidateCluster) {
  const candidate = cluster.representative;
  return {
    id: cluster.id,
    representativeCandidateId: candidate.id,
    label: truncate(cluster.label, 120),
    description: truncate(cluster.description, 600),
    categoryHint: cluster.categoryHint,
    recommendedStructure: recommendedStructureForCandidate(candidate),
    score: round(cluster.score),
    occurrenceCount: cluster.candidates.length,
    slideNumbers: uniqueSlideIndexes(cluster).map((index) => index + 1),
    bounds: roundedBounds(candidate.bounds),
    elements: candidate.elements.slice(0, MAX_ELEMENTS_PER_TEMPLATE).map(elementSummary),
  };
}

function elementSummary(element: SlideElement) {
  return {
    type: element.type,
    role: elementRole(element),
    bounds: roundedBounds(elementBounds(element)),
    style: styleTokens(element).slice(0, 12),
    text:
      element.type === "text" || element.type === "text-list"
        ? truncate(oneLine(textContentForSummary(element)), 140)
        : undefined,
  };
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
      candidates.push(makeCandidate({
        key: `imported-${componentId}`,
        label,
        description: `Recovered component from imported slide ${slideIndex + 1}.`,
        elements,
        source: "explicit",
        slideIndex,
        elementIndexes: range(start, index),
        categoryHint: classifyElements(elements),
        score: 1_000 + elements.length * 12,
        signature: `explicit:${componentId}:${layoutSignature(elements)}`,
      }));
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
      candidates.push(makeCandidate({
        key: `imported-block-${slideIndex + 1}-${containerIndex + 1}`,
        label,
        description: `Grouped design block extracted from imported slide ${slideIndex + 1}.`,
        elements,
        source: "container",
        slideIndex,
        elementIndexes: members.map(({ index }) => index),
        categoryHint: classifyElements(elements),
        score: 700 + elements.length * 10 - elementArea(container),
        signature: `block:${layoutSignature(elements)}`,
      }));
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

      candidates.push(makeCandidate({
        key: `imported-title-${slideIndex + 1}-${elementIndex + 1}`,
        label: labelFromElements(elements, "Title Lockup"),
        description: `Title lockup extracted from imported slide ${slideIndex + 1}.`,
        elements,
        source: "title-lockup",
        slideIndex,
        elementIndexes: [
          elementIndex,
          ...accents.map(({ index }) => index),
        ].sort((a, b) => a - b),
        categoryHint: "title-lockup",
        score: 560 + accents.length * 12,
        signature: `title:${layoutSignature(elements)}`,
      }));
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
      candidates.push(makeCandidate({
        key: `imported-image-${slideIndex + 1}-${elementIndex + 1}`,
        label,
        description: `Image asset extracted from imported slide ${slideIndex + 1}.`,
        elements: [element],
        source: "media",
        slideIndex,
        elementIndexes: [elementIndex],
        categoryHint: "image-asset",
        score: 360 + Math.min(80, area * 5),
        signature: `image:${imageIdentity(element)}:${roundForSignature(elementBounds(element).w)}x${roundForSignature(elementBounds(element).h)}`,
      }));
    });
  });

  return candidates;
}

function templateElementsForCandidate(
  candidate: Candidate,
  componentId: string,
  description: string,
  requestedStructure?: DesignElementStructure,
): SlideElement[] {
  if (candidate.elements.length === 1 && candidate.categoryHint === "image-asset") {
    return withTemplateMetadata(candidate.elements, componentId, description);
  }

  const structure = resolveTemplateStructure(candidate, requestedStructure);
  const element = withTemplateMetadata(
    [semanticElementForCandidate(candidate, structure)],
    componentId,
    description,
  )[0];
  return element ? [element] : [];
}

function semanticElementForCandidate(
  candidate: Candidate,
  structure: DesignElementStructure,
): SlideElement {
  if (structure === "container") {
    const container = containerTemplateElement(candidate);
    if (container) return container;
  }
  if (structure === "grid") return gridTemplateElement(candidate);
  if (structure === "flex") return flexTemplateElement(candidate);
  return groupTemplateElement(candidate);
}

function resolveTemplateStructure(
  candidate: Candidate,
  requested?: DesignElementStructure,
): DesignElementStructure {
  const recommended = recommendedStructureForCandidate(candidate);
  if (recommended === "container") return "container";
  if (requested === "container" && findContainerShellIndex(candidate.elements, candidate.bounds) >= 0) {
    return "container";
  }
  if (requested === "grid" && looksGridLike(candidate.elements, candidate.bounds)) {
    return "grid";
  }
  if (requested === "flex" && looksFlexLike(candidate.elements, candidate.bounds)) {
    return "flex";
  }
  if (requested === "group") return "group";
  return recommended;
}

function recommendedStructureForCandidate(
  candidate: Pick<Candidate, "elements" | "bounds" | "categoryHint">,
): DesignElementStructure {
  if (findContainerShellIndex(candidate.elements, candidate.bounds) >= 0) {
    return "container";
  }
  if (looksGridLike(candidate.elements, candidate.bounds)) return "grid";
  if (
    (candidate.categoryHint === "navigation" ||
      candidate.categoryHint === "badge" ||
      candidate.categoryHint === "cta" ||
      candidate.categoryHint === "title-lockup") &&
    looksFlexLike(candidate.elements, candidate.bounds)
  ) {
    return "flex";
  }
  return "group";
}

function groupTemplateElement(candidate: Candidate): SlideElement {
  return {
    type: "group",
    position: { x: safeGeometry(candidate.bounds.x), y: safeGeometry(candidate.bounds.y) },
    size: {
      width: safeSize(candidate.bounds.w),
      height: safeSize(candidate.bounds.h),
    },
    children: relativeElements(candidate.elements, candidate.bounds),
  };
}

function flexTemplateElement(candidate: Candidate): SlideElement {
  const direction = candidate.bounds.w >= candidate.bounds.h ? "row" : "column";
  return {
    ...groupFrame(candidate.bounds),
    type: "flex",
    direction,
    alignItems: "center",
    justifyContent: "flex-start",
    gap: inferFlexGap(candidate.elements, candidate.bounds, direction),
    children: relativeElements(candidate.elements, candidate.bounds),
  };
}

function gridTemplateElement(candidate: Candidate): SlideElement {
  return {
    ...groupFrame(candidate.bounds),
    type: "grid",
    columns: inferGridColumns(candidate.elements),
    gap: inferGridGap(candidate.elements, candidate.bounds),
    children: relativeElements(candidate.elements, candidate.bounds),
  };
}

function containerTemplateElement(candidate: Candidate): SlideElement | null {
  const shellIndex = findContainerShellIndex(candidate.elements, candidate.bounds);
  const shell = candidate.elements[shellIndex];
  if (!shell || shell.type !== "rectangle") return null;

  const shellBounds = elementBounds(shell);
  const childElements = candidate.elements.filter((_, index) => index !== shellIndex);
  const child: SlideElement | undefined =
    childElements.length > 0
      ? {
          type: "group",
          position: { x: 0, y: 0 },
          size: {
            width: safeSize(shellBounds.w),
            height: safeSize(shellBounds.h),
          },
          children: relativeElements(childElements, shellBounds),
        }
      : undefined;

  return {
    type: "container",
    position: { x: safeGeometry(shellBounds.x), y: safeGeometry(shellBounds.y) },
    size: {
      width: safeSize(shellBounds.w),
      height: safeSize(shellBounds.h),
    },
    fill: fillWithElementOpacity(shell.fill, shell.opacity),
    stroke: strokeWithElementOpacity(shell.stroke, shell.opacity),
    borderRadius: shell.borderRadius,
    shadow: shell.shadow,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    child,
  };
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

function groupFrame(bounds: Bounds) {
  return {
    position: { x: safeGeometry(bounds.x), y: safeGeometry(bounds.y) },
    size: {
      width: safeSize(bounds.w),
      height: safeSize(bounds.h),
    },
  };
}

function relativeElements(elements: SlideElement[], bounds: Bounds): SlideElement[] {
  return elements.map((element) => relativeElement(element, bounds));
}

function relativeElement(element: SlideElement, bounds: Bounds): SlideElement {
  const copy = stripTemplateMetadata(cloneElement(element));
  const box = elementBounds(copy);
  return {
    ...copy,
    position: {
      x: safeGeometry(box.x - bounds.x),
      y: safeGeometry(box.y - bounds.y),
    },
    size: {
      width: safeSize(box.w),
      height: safeSize(box.h),
    },
  } as SlideElement;
}

function stripTemplateMetadata(element: SlideElement): SlideElement {
  delete element.componentId;
  delete element.componentInstanceId;
  delete element.componentDescription;

  if (element.type === "container" && element.child) {
    element.child = stripTemplateMetadata(element.child);
  } else if (
    element.type === "group" ||
    element.type === "flex" ||
    element.type === "grid"
  ) {
    element.children = element.children.map(stripTemplateMetadata);
  } else if (element.type === "list-view" || element.type === "grid-view") {
    element.item = stripTemplateMetadata(element.item);
  }

  return element;
}

function fillWithElementOpacity(
  fill: Extract<SlideElement, { type: "rectangle" }>["fill"],
  opacity: number | null | undefined,
) {
  if (!fill || opacity == null || opacity >= 1) return fill;
  return {
    ...fill,
    opacity: (fill.opacity ?? 1) * opacity,
  };
}

function strokeWithElementOpacity(
  stroke: Extract<SlideElement, { type: "rectangle" }>["stroke"],
  opacity: number | null | undefined,
) {
  if (!stroke || opacity == null || opacity >= 1) return stroke;
  return {
    ...stroke,
    opacity: (stroke.opacity ?? 1) * opacity,
  };
}

function findContainerShellIndex(elements: SlideElement[], bounds: Bounds): number {
  return elements.findIndex((element) => {
    if (element.type !== "rectangle") return false;
    if (element.opacity === 0 || element.rotation) return false;
    if (!element.fill && !element.stroke && !element.shadow) return false;

    const box = elementBounds(element);
    const areaRatio = (box.w * box.h) / Math.max(0.01, bounds.w * bounds.h);
    if (areaRatio < 0.48 || areaRatio > 1.18) return false;

    const padded = padBounds(box, 0.05);
    return elements.every(
      (child) => child === element || elementFitsWithin(child, padded),
    );
  });
}

function looksFlexLike(elements: SlideElement[], bounds: Bounds): boolean {
  if (elements.length < 2 || elements.length > MAX_ELEMENTS_PER_TEMPLATE) return false;
  const boxes = elements.map(elementBounds);
  const centersX = boxes.map((box) => box.x + box.w / 2);
  const centersY = boxes.map((box) => box.y + box.h / 2);
  const xSpread = Math.max(...centersX) - Math.min(...centersX);
  const ySpread = Math.max(...centersY) - Math.min(...centersY);
  const rowLike = ySpread <= Math.max(0.18, bounds.h * 0.32) && xSpread > 0.24;
  const columnLike = xSpread <= Math.max(0.18, bounds.w * 0.32) && ySpread > 0.24;
  return rowLike || columnLike;
}

function looksGridLike(elements: SlideElement[], bounds: Bounds): boolean {
  if (elements.length < 4) return false;
  const boxes = elements.map(elementBounds);
  const xBands = bandCount(
    boxes.map((box) => box.x + box.w / 2),
    Math.max(0.16, bounds.w * 0.08),
  );
  const yBands = bandCount(
    boxes.map((box) => box.y + box.h / 2),
    Math.max(0.16, bounds.h * 0.08),
  );
  return xBands >= 2 && yBands >= 2;
}

function inferGridColumns(elements: SlideElement[]): number {
  const boxes = elements.map(elementBounds);
  const bounds = boundsForElements(elements);
  return Math.max(
    1,
    Math.min(
      6,
      bandCount(
        boxes.map((box) => box.x + box.w / 2),
        Math.max(0.16, bounds.w * 0.08),
      ),
    ),
  );
}

function inferGridGap(elements: SlideElement[], bounds: Bounds): number {
  if (!looksGridLike(elements, bounds)) return 0;
  return 0;
}

function inferFlexGap(
  elements: SlideElement[],
  bounds: Bounds,
  direction: "row" | "column",
): number {
  if (!looksFlexLike(elements, bounds)) return 0;
  const boxes = elements.map(elementBounds).sort((a, b) =>
    direction === "row" ? a.x - b.x : a.y - b.y,
  );
  const gaps = boxes.slice(1).map((box, index) => {
    const previous = boxes[index];
    if (!previous) return 0;
    return direction === "row"
      ? box.x - (previous.x + previous.w)
      : box.y - (previous.y + previous.h);
  });
  const positive = gaps.filter((gap) => gap > 0.01);
  if (positive.length === 0) return 0;
  return safeGeometry(
    positive.reduce((sum, gap) => sum + gap, 0) / positive.length,
  );
}

function bandCount(values: number[], tolerance: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const bands: number[] = [];
  for (const value of sorted) {
    const existingIndex = bands.findIndex(
      (band) => Math.abs(value - band) <= tolerance,
    );
    if (existingIndex >= 0) {
      bands[existingIndex] = (bands[existingIndex] + value) / 2;
    } else {
      bands.push(value);
    }
  }
  return bands.length;
}

function safeGeometry(value: number): number {
  return Math.max(0, Math.round(value * 10_000) / 10_000);
}

function safeSize(value: number): number {
  return Math.max(0.01, Math.round(value * 10_000) / 10_000);
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

function classifyElements(elements: SlideElement[]): DesignElementCategory {
  const bounds = boundsForElements(elements);
  const textElements = elements.filter(
    (element): element is Extract<SlideElement, { type: "text" }> =>
      element.type === "text",
  );
  const imageCount = elements.filter((element) => element.type === "image").length;
  const shapeCount = elements.filter(
    (element) =>
      element.type === "rectangle" ||
      element.type === "ellipse" ||
      element.type === "line",
  ).length;

  if (elements.length === 1 && elements[0]?.type === "image") return "image-asset";
  if (isDividerLike(elements, bounds)) return "divider";
  if (textElements.some((element) => isStatText(textContent(element)))) return "stat-card";

  const hasHeading = textElements.some((element) => isHeadingText(element));
  const hasText = textElements.length > 0 || elements.some((element) => element.type === "text-list");
  const compactHorizontal = bounds.h <= 0.65 && bounds.w >= 0.7;

  if (compactHorizontal && hasText && shapeCount > 0) {
    return bounds.w > 1.1 ? "navigation" : "badge";
  }
  if (imageCount > 0 && hasText) return "media-card";
  if (hasHeading) return "title-lockup";
  if (hasText && shapeCount > 0) return "content-card";
  if (shapeCount > 0 && elements.length <= 3) return "decorative";
  return "unknown";
}

function isDividerLike(elements: SlideElement[], bounds: Bounds): boolean {
  if (elements.length > 2) return false;
  if (bounds.h <= 0.08 && bounds.w >= 0.6) return true;
  return bounds.w <= 0.08 && bounds.h >= 0.6;
}

function isStatText(text: string): boolean {
  return /(?:\$|%|\b\d+(?:\.\d+)?x\b|\b\d{2,}\b)/i.test(text.trim());
}

function compatibleCategories(
  a: DesignElementCategory,
  b: DesignElementCategory,
): boolean {
  const families: DesignElementCategory[][] = [
    ["navigation", "badge", "cta"],
    ["content-card", "media-card", "stat-card"],
    ["title-lockup", "divider", "decorative"],
  ];
  return families.some((family) => family.includes(a) && family.includes(b));
}

function fuzzyLayoutSignature(
  elements: SlideElement[],
  category: DesignElementCategory,
): string {
  return [
    category,
    elementTypeSequence(elements),
    layoutTokens(elements).join(";"),
    styleTokensForElements(elements).join(";"),
  ].join("|");
}

function elementTypeSequence(elements: SlideElement[]): string {
  return elements.map((element) => element.type).join(">");
}

function layoutTokens(elements: SlideElement[]): string[] {
  const bounds = boundsForElements(elements);
  const width = Math.max(0.01, bounds.w);
  const height = Math.max(0.01, bounds.h);
  return elements
    .map((element) => {
      const box = elementBounds(element);
      return [
        element.type,
        quantize((box.x - bounds.x) / width, 12),
        quantize((box.y - bounds.y) / height, 12),
        quantize(box.w / width, 12),
        quantize(box.h / height, 12),
      ].join(":");
    })
    .sort();
}

function styleTokensForElements(elements: SlideElement[]): string[] {
  return [...new Set(elements.flatMap(styleTokens))].sort();
}

function styleTokens(element: SlideElement): string[] {
  if (element.type === "text") {
    const font = elementFont(element);
    return [
      `font:${font.family}`,
      `size:${Math.round(font.size / 4) * 4}`,
      `color:${normalizeColor(font.color)}`,
      font.bold ? "bold" : "regular",
      `align:${element.alignment?.horizontal ?? "left"}`,
      `text-bin:${Math.ceil(textContent(element).trim().length / 16)}`,
    ];
  }
  if (element.type === "text-list") {
    const font = elementFont(element);
    return [
      `font:${font.family}`,
      `size:${Math.round(font.size / 4) * 4}`,
      `color:${normalizeColor(font.color)}`,
      `items:${Math.min(6, textListStrings(element).length)}`,
    ];
  }
  if (element.type === "rectangle") {
    return [
      `fill:${normalizeColor(fillColor(element.fill, ""))}`,
      `stroke:${element.stroke?.color ? normalizeColor(strokeColor(element.stroke)) : ""}`,
      `radius:${
        element.borderRadius
          ? roundForSignature(averageBorderRadius(element.borderRadius))
          : 0
      }`,
    ];
  }
  if (element.type === "ellipse") {
    return [
      `fill:${normalizeColor(fillColor(element.fill, ""))}`,
      `stroke:${element.stroke?.color ? normalizeColor(strokeColor(element.stroke)) : ""}`,
      "ellipse",
    ];
  }
  if (element.type === "line") {
    return [
      `stroke:${normalizeColor(strokeColor(element.stroke, ""))}`,
      `width:${roundForSignature(element.stroke.width ?? 0)}`,
    ];
  }
  if (element.type === "image") {
    return [
      `fit:${element.fit ?? "cover"}`,
      element.borderRadius
        ? `radius:${roundForSignature(averageBorderRadius(element.borderRadius))}`
        : "radius:0",
    ];
  }
  if (element.type === "table") {
    return [
      "table",
      `fill:${normalizeColor(fillColor(element.columns[0]?.fill, ""))}`,
      `rows:${element.rows.length}`,
      `cols:${element.columns.length}`,
    ];
  }
  if (element.type === "chart") {
    return [`chart:${element.chartType}`, `color:${normalizeColor(chartColor(element))}`];
  }
  if (element.type === "svg") {
    return [`svg:${element.name ?? ""}`];
  }
  return [element.type];
}

function elementRole(element: SlideElement): string {
  if (element.type === "text") {
    const text = textContent(element);
    if (isStatText(text)) return "stat text";
    if (isHeadingText(element)) return "heading text";
    return text.length <= 32 ? "label text" : "body text";
  }
  if (element.type === "text-list") return "text list";
  if (element.type === "image") {
    const box = elementBounds(element);
    return box.w <= 0.35 && box.h <= 0.35 ? "icon image" : "photo image";
  }
  if (element.type === "rectangle" || element.type === "ellipse") {
    const box = elementBounds(element);
    if (box.h <= 0.08 || box.w <= 0.08) return "accent shape";
    return "container shape";
  }
  if (element.type === "line") return "divider line";
  return element.type;
}

function textContentForSummary(element: SlideElement): string {
  if (element.type === "text") return textContent(element);
  if (element.type === "text-list") return textListStrings(element).join(" / ");
  return "";
}

function uniqueClusterId(
  candidate: Candidate,
  clusters: DesignElementCandidateCluster[],
): string {
  const usedIds = new Set(clusters.map((cluster) => cluster.id));
  const base = truncate(
    `cluster-${slugify(candidate.categoryHint)}-${sampleHash(candidate.clusterSignature)}`,
    120,
  );
  let id = base;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = truncate(`${base}-${suffix}`, 140);
    suffix += 1;
  }
  return id;
}

function candidateId(
  source: Candidate["source"],
  slideIndex: number,
  elementIndexes: number[],
  key: string,
): string {
  return truncate(
    `${source}-${slideIndex + 1}-${elementIndexes.join("-")}-${sampleHash(key)}`,
    140,
  );
}

function uniqueSlideIndexes(cluster: DesignElementCandidateCluster): number[] {
  return [...new Set(cluster.candidates.map((candidate) => candidate.slideIndex))].sort(
    (a, b) => a - b,
  );
}

function categoryScoreBonus(category: DesignElementCategory): number {
  switch (category) {
    case "navigation":
      return 110;
    case "title-lockup":
      return 95;
    case "media-card":
    case "content-card":
    case "stat-card":
      return 80;
    case "badge":
    case "cta":
      return 55;
    case "image-asset":
      return 20;
    case "divider":
    case "decorative":
      return -20;
    default:
      return 0;
  }
}

function categoryDisplayName(category: DesignElementCategory): string {
  switch (category) {
    case "navigation":
      return "Navigation";
    case "badge":
      return "Badge";
    case "title-lockup":
      return "Title Lockup";
    case "content-card":
      return "Content Card";
    case "media-card":
      return "Media Card";
    case "stat-card":
      return "Stat Card";
    case "cta":
      return "CTA";
    case "image-asset":
      return "Image Asset";
    case "divider":
      return "Divider";
    case "decorative":
      return "Decorative";
    default:
      return "Design Element";
  }
}

function roundedBounds(bounds: Bounds): Bounds {
  return {
    x: round(bounds.x),
    y: round(bounds.y),
    w: round(bounds.w),
    h: round(bounds.h),
  };
}

function firstImageIdentity(elements: SlideElement[]): string {
  const image = elements.find(
    (element): element is Extract<SlideElement, { type: "image" }> =>
      element.type === "image",
  );
  return image ? imageIdentity(image) : "";
}

function indexJaccard(a: number[], b: number[]): number {
  return jaccard(
    a.map((value) => String(value)),
    b.map((value) => String(value)),
  );
}

function jaccard(a: string[], b: string[]): number {
  const aSet = new Set(a);
  const bSet = new Set(b);
  const union = new Set([...aSet, ...bSet]);
  if (union.size === 0) return 1;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function sizeSimilarity(a: Bounds, b: Bounds): number {
  const width = Math.min(a.w, b.w) / Math.max(0.01, Math.max(a.w, b.w));
  const height = Math.min(a.h, b.h) / Math.max(0.01, Math.max(a.h, b.h));
  return (width + height) / 2;
}

function range(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start) }, (_, index) => start + index);
}

function quantize(value: number, steps: number): number {
  return Math.round(value * steps) / steps;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
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
