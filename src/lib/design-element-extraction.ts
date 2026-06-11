import { z } from "zod";
import { agnes } from "ml-hclust";
import { similarity as vectorSimilarity } from "ml-distance";
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
  intent?: DesignElementIntent;
  qualityScore?: number;
  slots?: DesignElementSlot[];
};

const SLIDE_AREA = SLIDE_W * SLIDE_H;
const MAX_TEMPLATES = 32;
const MAX_ELEMENTS_PER_TEMPLATE = 12;
const MAX_LLM_CLUSTERS = 60;
const MIN_GROUP_AREA = SLIDE_AREA * 0.006;
const MAX_GROUP_AREA = SLIDE_AREA * 0.45;
const MAX_LAYOUT_PATTERN_AREA = SLIDE_AREA * 0.68;
const CLUSTER_DISTANCE_THRESHOLD = 0.22;

export const DesignElementCategorySchema = z.enum([
  "navigation",
  "badge",
  "title-lockup",
  "content-card",
  "media-card",
  "stat-card",
  "chart",
  "table",
  "cta",
  "image-asset",
  "divider",
  "decorative",
  "unknown",
]);

export type DesignElementCategory = z.infer<typeof DesignElementCategorySchema>;

export const DesignElementIntentSchema = z.enum([
  "author-pill",
  "badge",
  "chart",
  "content-card",
  "cta-button",
  "decorative-accent",
  "divider",
  "feature-list",
  "icon-label-row",
  "image-asset",
  "insight-grid",
  "media-card",
  "metric-card",
  "navigation-pill",
  "stat-card",
  "table",
  "title-lockup",
  "unknown",
]);

export type DesignElementIntent = z.infer<typeof DesignElementIntentSchema>;

export const DesignElementSlotKindSchema = z.enum([
  "accent",
  "body",
  "chart",
  "date",
  "icon",
  "image",
  "label",
  "list",
  "metric",
  "shape",
  "table",
  "title",
]);

export type DesignElementSlotKind = z.infer<typeof DesignElementSlotKindSchema>;

export type DesignElementSlot = {
  elementIndexes: number[];
  kind: DesignElementSlotKind;
  name: string;
  role: string;
  text?: string;
};

type DesignElementQuality = {
  issues: string[];
  score: number;
  strengths: string[];
};

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

const CurationSlotSchema = z
  .object({
    elementIndexes: z.array(z.number().int().min(0).max(MAX_ELEMENTS_PER_TEMPLATE)).max(8),
    kind: DesignElementSlotKindSchema,
    name: z.string().min(1).max(80),
    role: z.string().min(1).max(120),
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
    editableSlots: z.array(CurationSlotSchema).max(16),
    intentHint: DesignElementIntentSchema,
    qualityIssues: z.array(z.string().min(1).max(140)).max(10),
    qualityScore: z.number().min(0).max(100),
    qualitySignals: z.array(z.string().min(1).max(140)).max(10),
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
    intent: DesignElementIntentSchema.nullish(),
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
  source:
    | "explicit"
    | "container"
    | "layout-flex"
    | "layout-grid"
    | "data"
    | "title-lockup"
    | "media";
  slideIndex: number;
  elementIndexes: number[];
  categoryHint: DesignElementCategory;
  bounds: Bounds;
  intentHint: DesignElementIntent;
  quality: DesignElementQuality;
  slots: DesignElementSlot[];
  score: number;
  signature: string;
  structureHint?: DesignElementStructure;
  clusterSignature: string;
};

type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

type IndexedElement = {
  bounds: Bounds;
  element: SlideElement;
  index: number;
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
  const discoveredCandidates = [
    ...explicitComponentCandidates(deck),
    ...containerGroupCandidates(deck),
    ...layoutPatternCandidates(deck),
    ...titleLockupCandidates(deck),
    ...dataElementCandidates(deck),
    ...mediaCandidates(deck),
  ];
  const rawCandidates = repairCandidates(deck, discoveredCandidates)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

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
      rawCandidateCount: discoveredCandidates.length,
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
    intent?: DesignElementIntent;
    representativeCandidateId?: string;
    structure?: DesignElementStructure;
    confidence: number;
  }> = [];
  const pinnedSelections = extraction.clusters
    .map((cluster) => {
      const candidate = pinnedDataCandidateForCluster(cluster);
      return candidate
        ? {
            cluster,
            label: candidate.label,
            description: candidate.description,
            intent: candidate.intentHint,
            representativeCandidateId: candidate.id,
            confidence: 1,
          }
        : null;
    })
    .filter((selection): selection is NonNullable<typeof selection> =>
      Boolean(selection),
    );
  const pinnedClusterIds = new Set(
    pinnedSelections.map((selection) => selection.cluster.id),
  );

  for (const decision of curation.decisions) {
    if (decision.action !== "keep") continue;
    const cluster = clustersById.get(decision.clusterId);
    if (!cluster || decision.confidence < 0.35) continue;
    if (pinnedClusterIds.has(cluster.id)) continue;
    orderedClusters.push({
      cluster,
      label: decision.label,
      description: decision.description,
      intent: decision.intent ?? undefined,
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
  const templates = templatesFromClusterSelections(
    [...pinnedSelections, ...orderedClusters],
    limit,
    selected,
  );

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
    intent?: DesignElementIntent;
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
      intent: selection.intent ?? candidate.intentHint,
      qualityScore: candidate.quality.score,
      slots: candidate.slots,
    });
    selected.add(cluster.id);

    if (templates.length >= limit) break;
  }

  return templates;
}

type CandidateInput = Omit<
  Candidate,
  "id" | "bounds" | "clusterSignature" | "intentHint" | "quality" | "slots"
> & {
  intentHint?: DesignElementIntent;
};

function makeCandidate(input: CandidateInput): Candidate {
  const bounds = boundsForElements(input.elements);
  const slots = editableSlotsForElements(input.elements);
  const inferredIntent = inferIntent({
    bounds,
    categoryHint: input.categoryHint,
    elements: input.elements,
    source: input.source,
    slots,
  });
  const intentHint =
    input.intentHint && input.intentHint !== "unknown"
      ? input.intentHint
      : inferredIntent;
  const quality = evaluateCandidateQuality({
    bounds,
    categoryHint: input.categoryHint,
    elements: input.elements,
    intentHint,
    slots,
    source: input.source,
  });
  return {
    ...input,
    id: candidateId(input.source, input.slideIndex, input.elementIndexes, input.key),
    bounds,
    intentHint,
    quality,
    score: input.score + quality.score * 2 + intentScoreBonus(intentHint),
    slots,
    clusterSignature: fuzzyLayoutSignature(input.elements, input.categoryHint),
  };
}

function repairCandidates(deck: Deck, candidates: Candidate[]): Candidate[] {
  return candidates.flatMap((candidate) => {
    const repaired = repairCandidate(deck, candidate);
    if (
      isPinnedDataCandidate(candidate) &&
      repaired.elementIndexes.join(",") !== candidate.elementIndexes.join(",")
    ) {
      return [candidate, repaired];
    }
    return [repaired];
  });
}

function repairCandidate(deck: Deck, candidate: Candidate): Candidate {
  if (candidate.source === "media") return candidate;

  const slide = deck.slides[candidate.slideIndex];
  if (!slide) return candidate;

  const indexes = new Set(candidate.elementIndexes);
  const reasons = new Set<string>();

  const sortedMembers = () =>
    [...indexes]
      .sort((a, b) => a - b)
      .map((index) => ({ element: slide.elements[index], index }))
      .filter(
        (member): member is { element: SlideElement; index: number } =>
          Boolean(member.element),
      );
  const sortedElements = () => sortedMembers().map(({ element }) => element);
  const currentBounds = () => boundsForElements(sortedElements());

  const addIndex = (index: number, reason: string) => {
    if (indexes.has(index)) return;
    const element = slide.elements[index];
    if (!element) return;
    if (indexes.size >= MAX_ELEMENTS_PER_TEMPLATE) return;
    if (isLikelyBackgroundElement(element, slide)) return;
    indexes.add(index);
    reasons.add(reason);
  };

  expandWithContainingShells(slide, indexes, addIndex, currentBounds);
  expandShellContents(slide, indexes, addIndex, sortedMembers);
  expandHeadingAccents(slide, indexes, addIndex, sortedMembers);
  expandIconTextPairs(slide, addIndex, sortedMembers);
  expandDataElementCompanions(slide, indexes, addIndex, sortedMembers);
  expandTitleBodyPairs(slide, indexes, addIndex, sortedMembers);

  if (reasons.size === 0) return candidate;

  const elementIndexes = [...indexes].sort((a, b) => a - b);
  const elements = elementIndexes
    .map((index) => slide.elements[index])
    .filter((element): element is SlideElement => Boolean(element));
  if (elements.length === candidate.elements.length) return candidate;

  const repairBonus = Math.min(90, 30 + reasons.size * 14);
  const label = labelFromElements(
    elements,
    candidate.label.split(":")[0] ?? candidate.label,
  );
  const baseScore =
    candidate.score -
    candidate.quality.score * 2 -
    intentScoreBonus(candidate.intentHint);

  const repairedCandidate = makeCandidate({
    key: `${candidate.key}-repaired-${sampleHash(elementIndexes.join(","))}`,
    label: truncate(label, 120),
    description: candidate.description,
    elements,
    source: candidate.source,
    slideIndex: candidate.slideIndex,
    elementIndexes,
    categoryHint: classifyElements(elements),
    score: Math.max(0, baseScore + repairBonus),
    signature: `repaired:${candidate.source}:${layoutSignature(elements)}`,
  });

  if (repairedCandidate.quality.score + 8 < candidate.quality.score) {
    return candidate;
  }

  return repairedCandidate;
}

function expandWithContainingShells(
  slide: Slide,
  indexes: Set<number>,
  addIndex: (index: number, reason: string) => void,
  currentBounds: () => Bounds,
) {
  const bounds = currentBounds();
  slide.elements.forEach((element, index) => {
    if (indexes.has(index)) return;
    if (!isContainerElement(element, slide)) return;
    const shellBounds = padBounds(elementBounds(element), 0.06);
    if (!boundsFitWithin(bounds, shellBounds)) return;

    const shellArea = Math.max(0.01, shellBounds.w * shellBounds.h);
    const contentArea = bounds.w * bounds.h;
    if (contentArea / shellArea < 0.04 && shellArea > SLIDE_AREA * 0.22) return;
    addIndex(index, "container shell");
  });
}

function expandShellContents(
  slide: Slide,
  indexes: Set<number>,
  addIndex: (index: number, reason: string) => void,
  sortedMembers: () => Array<{ element: SlideElement; index: number }>,
) {
  const shells = sortedMembers().filter(({ element }) =>
    isContainerElement(element, slide),
  );
  for (const shell of shells) {
    const shellBounds = padBounds(elementBounds(shell.element), 0.06);
    slide.elements.forEach((element, index) => {
      if (indexes.has(index)) return;
      if (indexes.size >= MAX_ELEMENTS_PER_TEMPLATE) return;
      if (isLikelyBackgroundElement(element, slide)) return;
      if (!elementFitsWithin(element, shellBounds)) return;
      if (!isMeaningfulCompanionElement(element)) return;
      addIndex(index, "container contents");
    });
  }
}

function expandHeadingAccents(
  slide: Slide,
  indexes: Set<number>,
  addIndex: (index: number, reason: string) => void,
  sortedMembers: () => Array<{ element: SlideElement; index: number }>,
) {
  for (const { element } of sortedMembers()) {
    if (element.type !== "text" || !isHeadingText(element)) continue;
    slide.elements.forEach((candidate, index) => {
      if (indexes.has(index)) return;
      if (isNearbyAccent(candidate, element)) addIndex(index, "heading accent");
    });
  }
}

function expandIconTextPairs(
  slide: Slide,
  addIndex: (index: number, reason: string) => void,
  sortedMembers: () => Array<{ element: SlideElement; index: number }>,
) {
  for (const { element } of sortedMembers()) {
    if (isIconLikeElement(element)) {
      nearestTextNeighbors(slide, element).forEach((index) =>
        addIndex(index, "icon text"),
      );
      continue;
    }

    if (element.type === "text") {
      nearestIconNeighbors(slide, element).forEach((index) =>
        addIndex(index, "text icon"),
      );
    }
  }
}

function expandTitleBodyPairs(
  slide: Slide,
  indexes: Set<number>,
  addIndex: (index: number, reason: string) => void,
  sortedMembers: () => Array<{ element: SlideElement; index: number }>,
) {
  for (const { element } of sortedMembers()) {
    if (element.type !== "text") continue;
    if (!isTitleLikeText(element)) continue;

    slide.elements.forEach((candidate, index) => {
      if (indexes.has(index)) return;
      if (candidate.type !== "text" && candidate.type !== "text-list") return;
      if (!isBodyCompanion(element, candidate)) return;
      addIndex(index, "supporting text");
    });
  }
}

function expandDataElementCompanions(
  slide: Slide,
  indexes: Set<number>,
  addIndex: (index: number, reason: string) => void,
  sortedMembers: () => Array<{ element: SlideElement; index: number }>,
) {
  for (const { element } of sortedMembers()) {
    if (element.type !== "chart" && element.type !== "table") continue;
    dataCompanionTextNeighbors(slide, element, indexes).forEach((index) =>
      addIndex(index, "data label"),
    );
  }
}

function dataCompanionTextNeighbors(
  slide: Slide,
  dataElement: SlideElement,
  indexes: Set<number>,
): number[] {
  const dataBox = elementBounds(dataElement);
  return slide.elements
    .map((element, index) => ({ element, index, bounds: elementBounds(element) }))
    .filter((member) => {
      if (indexes.has(member.index)) return false;
      if (member.element.type !== "text" && member.element.type !== "text-list") {
        return false;
      }
      if (isFooterTextElement(member.element, member.bounds)) return false;
      if (textContentForSummary(member.element).trim().length === 0) return false;

      const box = member.bounds;
      const gapAbove = dataBox.y - (box.y + box.h);
      const gapBelow = box.y - (dataBox.y + dataBox.h);
      const closeVertically =
        (gapAbove >= -0.08 && gapAbove <= 0.55) ||
        (gapBelow >= -0.06 && gapBelow <= 0.38);
      if (!closeVertically) return false;

      const overlap = horizontalOverlapRatio(dataBox, box);
      const centerDelta = Math.abs(
        (dataBox.x + dataBox.w / 2) - (box.x + box.w / 2),
      );
      return overlap >= 0.22 || centerDelta <= Math.max(0.45, dataBox.w * 0.28);
    })
    .sort((a, b) => {
      const aGap = verticalGapToDataElement(dataBox, a.bounds);
      const bGap = verticalGapToDataElement(dataBox, b.bounds);
      return aGap - bGap || a.index - b.index;
    })
    .slice(0, 2)
    .map(({ index }) => index);
}

function isFooterTextElement(element: SlideElement, bounds: Bounds): boolean {
  if (element.type !== "text" && element.type !== "text-list") return false;
  if (bounds.y < SLIDE_H - 0.55) return false;
  return elementFont(element).size <= 14;
}

function verticalGapToDataElement(dataBox: Bounds, textBox: Bounds): number {
  if (textBox.y + textBox.h <= dataBox.y) {
    return dataBox.y - (textBox.y + textBox.h);
  }
  if (textBox.y >= dataBox.y + dataBox.h) {
    return textBox.y - (dataBox.y + dataBox.h);
  }
  return 0;
}

function nearestTextNeighbors(slide: Slide, anchor: SlideElement): number[] {
  const anchorBox = elementBounds(anchor);
  return slide.elements
    .map((element, index) => ({ element, index }))
    .filter(
      (member): member is { element: SlideElement; index: number } =>
        Boolean(member.element) &&
        (member.element.type === "text" || member.element.type === "text-list") &&
        isHorizontalCompanion(anchorBox, elementBounds(member.element)),
    )
    .sort(
      (a, b) =>
        horizontalGap(anchorBox, elementBounds(a.element)) -
        horizontalGap(anchorBox, elementBounds(b.element)),
    )
    .slice(0, 2)
    .map(({ index }) => index);
}

function nearestIconNeighbors(slide: Slide, text: SlideElement): number[] {
  const textBox = elementBounds(text);
  return slide.elements
    .map((element, index) => ({ element, index }))
    .filter(
      (member): member is { element: SlideElement; index: number } =>
        Boolean(member.element) &&
        isIconLikeElement(member.element) &&
        isHorizontalCompanion(elementBounds(member.element), textBox),
    )
    .sort(
      (a, b) =>
        horizontalGap(elementBounds(a.element), textBox) -
        horizontalGap(elementBounds(b.element), textBox),
    )
    .slice(0, 1)
    .map(({ index }) => index);
}

function isMeaningfulCompanionElement(element: SlideElement): boolean {
  if (element.type === "text") return textContent(element).trim().length > 0;
  if (element.type === "text-list") return textListStrings(element).length > 0;
  return (
    element.type === "image" ||
    element.type === "svg" ||
    element.type === "chart" ||
    element.type === "table" ||
    element.type === "line" ||
    element.type === "rectangle" ||
    element.type === "ellipse"
  );
}

function isIconLikeElement(element: SlideElement): boolean {
  const box = elementBounds(element);
  if (element.type === "svg") return box.w <= 0.75 && box.h <= 0.75;
  if (element.type === "image") return box.w <= 0.75 && box.h <= 0.75;
  if (element.type === "ellipse") return box.w <= 0.75 && box.h <= 0.75;
  if (element.type === "rectangle") {
    return box.w <= 0.75 && box.h <= 0.75 && !isDividerLike([element], box);
  }
  return false;
}

function isTitleLikeText(element: Extract<SlideElement, { type: "text" }>): boolean {
  const font = elementFont(element);
  return isHeadingText(element) || font.bold === true || font.size >= 16;
}

function isBodyCompanion(title: SlideElement, candidate: SlideElement): boolean {
  const titleBox = elementBounds(title);
  const bodyBox = elementBounds(candidate);
  if (bodyBox.y < titleBox.y + titleBox.h - 0.06) return false;
  if (bodyBox.y - (titleBox.y + titleBox.h) > 0.62) return false;
  const overlap = horizontalOverlapRatio(titleBox, bodyBox);
  if (overlap < 0.28 && Math.abs(bodyBox.x - titleBox.x) > 0.28) return false;
  const bodyText =
    candidate.type === "text"
      ? textContent(candidate).trim()
      : candidate.type === "text-list"
        ? textListStrings(candidate).join(" ").trim()
        : "";
  return bodyText.length > 0;
}

function isHorizontalCompanion(left: Bounds, right: Bounds): boolean {
  const gap = horizontalGap(left, right);
  if (gap < -0.08 || gap > 0.82) return false;
  const centerDelta = Math.abs((left.y + left.h / 2) - (right.y + right.h / 2));
  const verticalOverlap =
    Math.min(left.y + left.h, right.y + right.h) - Math.max(left.y, right.y);
  return (
    verticalOverlap >= Math.min(left.h, right.h) * 0.25 ||
    centerDelta <= Math.max(0.18, Math.max(left.h, right.h) * 0.55)
  );
}

function horizontalGap(left: Bounds, right: Bounds): number {
  return right.x - (left.x + left.w);
}

function horizontalOverlapRatio(a: Bounds, b: Bounds): number {
  const overlap = Math.max(
    0,
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x),
  );
  return overlap / Math.max(0.01, Math.min(a.w, b.w));
}

function boundsFitWithin(inner: Bounds, outer: Bounds): boolean {
  const centerX = inner.x + inner.w / 2;
  const centerY = inner.y + inner.h / 2;
  const centerInside =
    centerX >= outer.x &&
    centerX <= outer.x + outer.w &&
    centerY >= outer.y &&
    centerY <= outer.y + outer.h;
  if (centerInside) return true;
  return (
    intersectionArea(inner, outer) / Math.max(0.01, inner.w * inner.h) >= 0.78
  );
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
      if (isPinnedDataCandidate(candidate)) return false;
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
  if (candidates.length === 0) return [];
  if (candidates.length === 1) {
    const [candidate] = candidates;
    return [{
      id: uniqueClusterId(candidate, []),
      categoryHint: candidate.categoryHint,
      label: labelForClusterCandidate(candidate),
      description: descriptionForClusterCandidate(candidate),
      representative: candidate,
      candidates: [candidate],
      score: candidate.score + categoryScoreBonus(candidate.categoryHint),
      signature: candidate.clusterSignature,
    }];
  }

  const tree = agnes(candidates, {
    method: "average",
    distanceFunction: candidateDistance,
  });
  const groups = tree
    .cut(CLUSTER_DISTANCE_THRESHOLD)
    .map((cluster) =>
      cluster
        .indices()
        .map((index) => candidates[index])
        .filter((candidate): candidate is Candidate => Boolean(candidate)),
    )
    .filter((group) => group.length > 0)
    .sort((a, b) => candidates.indexOf(a[0]!) - candidates.indexOf(b[0]!));

  const clusters: DesignElementCandidateCluster[] = [];
  for (const group of groups) {
    const representative = [...group].sort(
      (a, b) => b.score - a.score || a.label.localeCompare(b.label),
    )[0]!;
    clusters.push({
      id: uniqueClusterId(representative, clusters),
      categoryHint: representative.categoryHint,
      label: representative.label,
      description: representative.description,
      representative,
      candidates: group.sort(
        (a, b) => b.score - a.score || a.label.localeCompare(b.label),
      ),
      score: representative.score,
      signature: representative.clusterSignature,
    });
  }

  for (const cluster of clusters) {
    cluster.score = clusterScore(cluster);
    cluster.label = labelForCluster(cluster);
    cluster.description = descriptionForCluster(cluster);
  }

  return clusters;
}

function candidateDistance(a: Candidate, b: Candidate): number {
  return Math.max(0, Math.min(1, 1 - candidateSimilarity(a, b)));
}

function candidateSimilarity(a: Candidate, b: Candidate): number {
  if (
    a.categoryHint === "image-asset" &&
    b.categoryHint === "image-asset" &&
    firstImageIdentity(a.elements) !== firstImageIdentity(b.elements)
  ) {
    return 0.25;
  }
  if (a.clusterSignature === b.clusterSignature) return 1;

  let score = 0;
  if (a.categoryHint === b.categoryHint) score += 0.14;
  else if (compatibleCategories(a.categoryHint, b.categoryHint)) score += 0.06;

  if (a.source === b.source) score += 0.05;
  if (a.intentHint === b.intentHint) score += 0.05;

  const aTypes = elementTypeSequence(a.elements);
  const bTypes = elementTypeSequence(b.elements);
  if (aTypes === bTypes) score += 0.18;
  else score += jaccard(aTypes.split(">"), bTypes.split(">")) * 0.1;

  score += jaccard(layoutTokens(a.elements), layoutTokens(b.elements)) * 0.24;
  score += jaccard(styleTokensForElements(a.elements), styleTokensForElements(b.elements)) * 0.12;
  score += sizeSimilarity(a.bounds, b.bounds) * 0.08;
  score += vectorSimilarity.cosine(candidateFeatureVector(a), candidateFeatureVector(b)) * 0.2;
  score += jaccard(candidateTextTokens(a), candidateTextTokens(b)) * 0.04;

  return Math.max(0, Math.min(1, score));
}

function labelForClusterCandidate(candidate: Candidate): string {
  return labelForCluster({
    id: candidate.id,
    categoryHint: candidate.categoryHint,
    label: candidate.label,
    description: candidate.description,
    representative: candidate,
    candidates: [candidate],
    score: candidate.score,
    signature: candidate.clusterSignature,
  });
}

function descriptionForClusterCandidate(candidate: Candidate): string {
  return descriptionForCluster({
    id: candidate.id,
    categoryHint: candidate.categoryHint,
    label: candidate.label,
    description: candidate.description,
    representative: candidate,
    candidates: [candidate],
    score: candidate.score,
    signature: candidate.clusterSignature,
  });
}

const CATEGORY_FEATURE_ORDER: DesignElementCategory[] = [
  "navigation",
  "badge",
  "title-lockup",
  "content-card",
  "media-card",
  "stat-card",
  "chart",
  "table",
  "cta",
  "image-asset",
  "divider",
  "decorative",
  "unknown",
];

const SOURCE_FEATURE_ORDER: Candidate["source"][] = [
  "explicit",
  "container",
  "layout-flex",
  "layout-grid",
  "data",
  "title-lockup",
  "media",
];

function candidateFeatureVector(candidate: Candidate): number[] {
  const elements = candidate.elements;
  const bounds = candidate.bounds;
  const elementCount = Math.max(1, elements.length);
  const typeCount = (predicate: (element: SlideElement) => boolean) =>
    elements.filter(predicate).length / elementCount;
  const textElements = elements.filter(
    (element): element is Extract<SlideElement, { type: "text" }> =>
      element.type === "text",
  );
  const fontSizes = textElements.map((element) => elementFont(element).size);
  const averageFontSize =
    fontSizes.length > 0
      ? fontSizes.reduce((sum, value) => sum + value, 0) / fontSizes.length
      : 0;
  const boldRatio =
    textElements.length > 0
      ? textElements.filter((element) => elementFont(element).bold).length /
        textElements.length
      : 0;
  const textLength =
    elements.reduce((sum, element) => sum + textContentForSummary(element).length, 0) /
    280;

  return [
    bounds.x / SLIDE_W,
    bounds.y / SLIDE_H,
    bounds.w / SLIDE_W,
    bounds.h / SLIDE_H,
    (bounds.w * bounds.h) / SLIDE_AREA,
    Math.min(3, bounds.w / Math.max(0.01, bounds.h)) / 3,
    (bounds.x + bounds.w / 2) / SLIDE_W,
    (bounds.y + bounds.h / 2) / SLIDE_H,
    Math.min(1, elements.length / MAX_ELEMENTS_PER_TEMPLATE),
    typeCount((element) => element.type === "text"),
    typeCount((element) => element.type === "text-list"),
    typeCount((element) => element.type === "image"),
    typeCount((element) => element.type === "svg"),
    typeCount((element) => element.type === "rectangle" || element.type === "ellipse"),
    typeCount((element) => element.type === "line"),
    typeCount((element) => element.type === "chart"),
    typeCount((element) => element.type === "table"),
    typeCount(
      (element) =>
        element.type === "container" ||
        element.type === "flex" ||
        element.type === "grid" ||
        element.type === "group" ||
        element.type === "list-view" ||
        element.type === "grid-view",
    ),
    Math.min(1, candidate.slots.length / 8),
    Math.min(1, textSlotCount(candidate.slots) / 6),
    hasIconSlot(candidate.slots) ? 1 : 0,
    findContainerShellIndex(elements, bounds) >= 0 ? 1 : 0,
    candidate.quality.score / 100,
    Math.min(1, distinctStyleTokenCount(elements) / 8),
    Math.min(1, averageFontSize / 72),
    boldRatio,
    Math.min(1, textLength),
    highValueIntent(candidate.intentHint) ? 1 : 0,
    ...CATEGORY_FEATURE_ORDER.map((category) =>
      candidate.categoryHint === category ? 1 : 0,
    ),
    ...SOURCE_FEATURE_ORDER.map((source) =>
      candidate.source === source ? 1 : 0,
    ),
  ];
}

function candidateTextTokens(candidate: Candidate): string[] {
  return [
    ...new Set(
      candidate.elements
        .flatMap((element) => textContentForSummary(element).toLowerCase().split(/[^a-z0-9]+/))
        .filter((token) => token.length >= 3 && !/^\d+$/.test(token)),
    ),
  ].sort();
}

function clusterScore(cluster: DesignElementCandidateCluster): number {
  const representativeScore = cluster.representative.score;
  const occurrenceBonus = Math.min(260, (cluster.candidates.length - 1) * 55);
  const slideBonus = Math.min(180, (uniqueSlideIndexes(cluster).length - 1) * 45);
  const categoryBonus = categoryScoreBonus(cluster.categoryHint);
  return representativeScore + occurrenceBonus + slideBonus + categoryBonus;
}

function labelForCluster(cluster: DesignElementCandidateCluster): string {
  if (
    cluster.representative.source === "data" &&
    (cluster.categoryHint === "chart" || cluster.categoryHint === "table")
  ) {
    return cluster.representative.label;
  }

  const categoryLabel =
    cluster.representative.source === "layout-grid"
      ? "Content Grid"
      : cluster.representative.source === "layout-flex"
        ? "Content Row"
        : categoryDisplayName(cluster.categoryHint);
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
    editableSlots: candidate.slots.slice(0, 16),
    intentHint: candidate.intentHint,
    qualityIssues: candidate.quality.issues.slice(0, 10),
    qualityScore: candidate.quality.score,
    qualitySignals: candidate.quality.strengths.slice(0, 10),
    recommendedStructure:
      candidate.structureHint ?? recommendedStructureForCandidate(candidate),
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
      element.type === "text" ||
      element.type === "text-list" ||
      element.type === "chart" ||
      element.type === "table"
        ? truncate(oneLine(textContentForSummary(element)), 140)
        : undefined,
  };
}

function editableSlotsForElements(elements: SlideElement[]): DesignElementSlot[] {
  const slots = elements
    .map((element, index) => slotForElement(element, index))
    .filter((slot): slot is DesignElementSlot => Boolean(slot))
    .slice(0, 16);

  const seen = new Map<string, number>();
  return slots.map((slot) => {
    const count = (seen.get(slot.name) ?? 0) + 1;
    seen.set(slot.name, count);
    return count === 1 ? slot : { ...slot, name: `${slot.name} ${count}` };
  });
}

function slotForElement(
  element: SlideElement,
  index: number,
): DesignElementSlot | null {
  if (element.type === "text") {
    const kind = textSlotKind(element);
    const role = elementRole(element);
    return {
      elementIndexes: [index],
      kind,
      name: slotNameForKind(kind),
      role,
      text: truncate(oneLine(textContent(element)), 140),
    };
  }

  if (element.type === "text-list") {
    return {
      elementIndexes: [index],
      kind: "list",
      name: "List",
      role: elementRole(element),
      text: truncate(oneLine(textListStrings(element).join(" / ")), 140),
    };
  }

  if (element.type === "image") {
    const box = elementBounds(element);
    const kind = box.w <= 0.45 && box.h <= 0.45 ? "icon" : "image";
    return {
      elementIndexes: [index],
      kind,
      name: kind === "icon" ? "Icon" : "Image",
      role: elementRole(element),
      text: element.name ? truncate(element.name, 140) : undefined,
    };
  }

  if (element.type === "svg") {
    return {
      elementIndexes: [index],
      kind: "icon",
      name: "Icon",
      role: elementRole(element),
      text: element.name ? truncate(element.name, 140) : undefined,
    };
  }

  if (element.type === "chart") {
    return {
      elementIndexes: [index],
      kind: "chart",
      name: "Chart",
      role: elementRole(element),
      text: truncate(chartText(element), 140) || undefined,
    };
  }

  if (element.type === "table") {
    return {
      elementIndexes: [index],
      kind: "table",
      name: "Table",
      role: elementRole(element),
      text: truncate(tableText(element), 140) || undefined,
    };
  }

  if (element.type === "line") {
    return {
      elementIndexes: [index],
      kind: "accent",
      name: "Accent",
      role: elementRole(element),
    };
  }

  if (element.type === "rectangle" || element.type === "ellipse") {
    const box = elementBounds(element);
    const small = box.w <= 0.45 && box.h <= 0.45;
    return {
      elementIndexes: [index],
      kind: small ? "icon" : "shape",
      name: small ? "Icon Shape" : "Shape",
      role: elementRole(element),
    };
  }

  return null;
}

function textSlotKind(
  element: Extract<SlideElement, { type: "text" }>,
): DesignElementSlotKind {
  const text = textContent(element).trim();
  const font = elementFont(element);
  if (isStatText(text)) return "metric";
  if (isDateLikeText(text)) return "date";
  if (isHeadingText(element) || font.bold === true || font.size >= 18) return "title";
  if (text.length <= 36) return "label";
  return "body";
}

function slotNameForKind(kind: DesignElementSlotKind): string {
  switch (kind) {
    case "metric":
      return "Metric";
    case "date":
      return "Date";
    case "title":
      return "Title";
    case "body":
      return "Body";
    case "label":
      return "Label";
    case "image":
      return "Image";
    case "icon":
      return "Icon";
    case "list":
      return "List";
    case "chart":
      return "Chart";
    case "table":
      return "Table";
    case "accent":
      return "Accent";
    case "shape":
      return "Shape";
  }
}

function inferIntent({
  bounds,
  categoryHint,
  elements,
  slots,
  source,
}: {
  bounds: Bounds;
  categoryHint: DesignElementCategory;
  elements: SlideElement[];
  slots: DesignElementSlot[];
  source: Candidate["source"];
}): DesignElementIntent {
  if (categoryHint === "image-asset") return "image-asset";
  if (categoryHint === "chart") return "chart";
  if (categoryHint === "table") return "table";
  if (categoryHint === "divider" || isDividerLike(elements, bounds)) return "divider";
  if (categoryHint === "navigation") return "navigation-pill";
  if (categoryHint === "badge") return "badge";
  if (categoryHint === "cta") return "cta-button";
  if (categoryHint === "title-lockup" || source === "title-lockup") return "title-lockup";
  if (isAuthorPill(elements, bounds, slots)) return "author-pill";
  if (source === "layout-grid" && textSlotCount(slots) >= 4) return "insight-grid";
  if (source === "layout-flex" && hasIconSlot(slots) && textSlotCount(slots) >= 2) {
    return "icon-label-row";
  }
  if (source === "layout-flex" || source === "layout-grid") return "feature-list";
  if (categoryHint === "media-card") return "media-card";
  if (categoryHint === "stat-card") {
    return slots.some((slot) => slot.kind === "metric") ? "metric-card" : "stat-card";
  }
  if (categoryHint === "decorative") return "decorative-accent";
  if (categoryHint === "content-card") return "content-card";
  return "unknown";
}

function evaluateCandidateQuality({
  bounds,
  categoryHint,
  elements,
  intentHint,
  slots,
  source,
}: {
  bounds: Bounds;
  categoryHint: DesignElementCategory;
  elements: SlideElement[];
  intentHint: DesignElementIntent;
  slots: DesignElementSlot[];
  source: Candidate["source"];
}): DesignElementQuality {
  let score = 42;
  const strengths: string[] = [];
  const issues: string[] = [];
  const areaRatio = (bounds.w * bounds.h) / SLIDE_AREA;
  const hasText = slots.some((slot) =>
    slot.kind === "title" ||
    slot.kind === "body" ||
    slot.kind === "label" ||
    slot.kind === "metric" ||
    slot.kind === "date" ||
    slot.kind === "list",
  );
  const hasVisual = slots.some((slot) =>
    slot.kind === "image" ||
    slot.kind === "icon" ||
    slot.kind === "chart" ||
    slot.kind === "table" ||
    slot.kind === "shape" ||
    slot.kind === "accent",
  );
  const hasDataElement = slots.some(
    (slot) => slot.kind === "chart" || slot.kind === "table",
  );
  const hasShell = findContainerShellIndex(elements, bounds) >= 0;

  if (slots.length >= 2) {
    score += 12;
    strengths.push(`${slots.length} editable slots`);
  } else if (slots.length === 0) {
    score -= 18;
    issues.push("no editable slots");
  }

  if (hasText && hasVisual) {
    score += 14;
    strengths.push("combines text with visual structure");
  }

  if (hasShell) {
    score += 12;
    strengths.push("has a clear container or frame");
  }

  if (source === "layout-grid" || source === "layout-flex") {
    score += 12;
    strengths.push("captures a reusable repeated layout");
  }

  if (source === "data" || hasDataElement) {
    score += 16;
    strengths.push("has editable data content");
  }

  if (source === "explicit") {
    score += 10;
    strengths.push("was explicitly grouped in the source deck");
  }

  if (highValueIntent(intentHint)) {
    score += 12;
    strengths.push(`clear ${intentDisplayName(intentHint)} intent`);
  }

  if (distinctStyleTokenCount(elements) >= 3) {
    score += 8;
    strengths.push("has distinctive styling");
  }

  if (areaRatio > 0.58) {
    score -= 22;
    issues.push("too close to full-slide layout");
  } else if (areaRatio > 0.42) {
    score -= 10;
    issues.push("large block, may be slide-specific");
  }

  if (areaRatio < 0.004) {
    score -= 18;
    issues.push("tiny fragment");
  }

  if (categoryHint === "decorative" && !hasText) {
    score -= 16;
    issues.push("mostly decorative");
  }

  if (categoryHint === "image-asset" && elements.length === 1) {
    score -= 10;
    issues.push("single image asset");
  }

  if (elements.length === 1 && hasText) {
    score -= 12;
    issues.push("single text fragment");
  }

  return {
    issues: issues.slice(0, 10),
    score: clampQuality(score),
    strengths: strengths.slice(0, 10),
  };
}

function intentScoreBonus(intent: DesignElementIntent): number {
  switch (intent) {
    case "author-pill":
    case "chart":
    case "insight-grid":
    case "metric-card":
    case "navigation-pill":
    case "table":
    case "title-lockup":
      return 60;
    case "content-card":
    case "feature-list":
    case "icon-label-row":
    case "media-card":
    case "stat-card":
      return 42;
    case "badge":
    case "cta-button":
      return 28;
    case "divider":
    case "image-asset":
      return 8;
    case "decorative-accent":
      return -16;
    default:
      return 0;
  }
}

function highValueIntent(intent: DesignElementIntent): boolean {
  return (
    intent === "author-pill" ||
    intent === "chart" ||
    intent === "content-card" ||
    intent === "feature-list" ||
    intent === "icon-label-row" ||
    intent === "insight-grid" ||
    intent === "media-card" ||
    intent === "metric-card" ||
    intent === "navigation-pill" ||
    intent === "stat-card" ||
    intent === "table" ||
    intent === "title-lockup"
  );
}

function intentDisplayName(intent: DesignElementIntent): string {
  return intent.replace(/-/g, " ");
}

function isAuthorPill(
  elements: SlideElement[],
  bounds: Bounds,
  slots: DesignElementSlot[],
): boolean {
  const compact = bounds.h <= 0.95 && bounds.w >= 2;
  const hasDate = slots.some((slot) => slot.kind === "date");
  const titleSlots = slots.filter((slot) => slot.kind === "title" || slot.kind === "label");
  const hasAvatarShape = elements.some((element) => {
    if (element.type !== "ellipse" && element.type !== "image" && element.type !== "svg") {
      return false;
    }
    const box = elementBounds(element);
    return box.w <= 0.6 && box.h <= 0.6;
  });
  return compact && hasDate && titleSlots.length >= 1 && hasAvatarShape;
}

function textSlotCount(slots: DesignElementSlot[]): number {
  return slots.filter((slot) =>
    slot.kind === "title" ||
    slot.kind === "body" ||
    slot.kind === "label" ||
    slot.kind === "metric" ||
    slot.kind === "date" ||
    slot.kind === "list",
  ).length;
}

function hasIconSlot(slots: DesignElementSlot[]): boolean {
  return slots.some((slot) => slot.kind === "icon");
}

function distinctStyleTokenCount(elements: SlideElement[]): number {
  return new Set(styleTokensForElements(elements)).size;
}

function isDateLikeText(text: string): boolean {
  return /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b20\d{2}\b/i.test(
    text.trim(),
  );
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

function layoutPatternCandidates(deck: Deck): Candidate[] {
  const candidates: Candidate[] = [];

  deck.slides.forEach((slide, slideIndex) => {
    const members = reusableLayoutMembers(slide);
    if (members.length < 2) return;

    const gridMembers = bestGridPatternMembers(members);
    if (gridMembers) {
      const elements = gridMembers.map(({ element }) => element);
      const indexes = gridMembers.map(({ index }) => index).sort((a, b) => a - b);
      candidates.push(makeCandidate({
        key: `imported-layout-grid-${slideIndex + 1}-${sampleHash(layoutSignature(elements))}`,
        label: labelFromElements(elements, "Content Grid"),
        description: `Grid layout extracted from imported slide ${slideIndex + 1}.`,
        elements,
        source: "layout-grid",
        slideIndex,
        elementIndexes: indexes,
        categoryHint: layoutPatternCategory(elements, "grid"),
        score: 640 + elements.length * 12 + layoutPatternScore(elements),
        signature: `layout-grid:${layoutSignature(elements)}`,
      }));
    }

    const flexMembers = gridMembers ? null : bestFlexPatternMembers(members);
    if (flexMembers) {
      const elements = flexMembers.map(({ element }) => element);
      const indexes = flexMembers.map(({ index }) => index).sort((a, b) => a - b);
      candidates.push(makeCandidate({
        key: `imported-layout-flex-${slideIndex + 1}-${sampleHash(layoutSignature(elements))}`,
        label: labelFromElements(elements, "Content Row"),
        description: `Flex layout extracted from imported slide ${slideIndex + 1}.`,
        elements,
        source: "layout-flex",
        slideIndex,
        elementIndexes: indexes,
        categoryHint: layoutPatternCategory(elements, "flex"),
        score: 600 + elements.length * 10 + layoutPatternScore(elements),
        signature: `layout-flex:${layoutSignature(elements)}`,
      }));
    }
  });

  return candidates;
}

function reusableLayoutMembers(slide: Slide): IndexedElement[] {
  return slide.elements
    .map((element, index) => ({ element, index, bounds: elementBounds(element) }))
    .filter((member) => isReusableLayoutMember(member, slide))
    .sort((a, b) => a.index - b.index);
}

function isReusableLayoutMember(
  member: IndexedElement,
  slide: Slide,
): boolean {
  const { bounds, element } = member;
  if (element.opacity === 0) return false;
  if (bounds.w <= 0.01 || bounds.h <= 0.01) return false;
  if (isLikelyBackgroundElement(element, slide)) return false;
  if (isSlideChromeElement(member)) return false;

  if (element.type === "text") {
    if (
      isHeadingText(element) &&
      slide.elements.some(
        (candidate, index) =>
          index !== member.index && isNearbyAccent(candidate, element),
      )
    ) {
      return false;
    }
    return textContent(element).trim().length > 0;
  }
  if (element.type === "text-list") return textListStrings(element).length > 0;
  if (
    element.type === "image" ||
    element.type === "svg" ||
    element.type === "chart" ||
    element.type === "table"
  ) {
    return true;
  }
  if (element.type === "line") return true;
  if (element.type === "rectangle" || element.type === "ellipse") {
    return elementArea(element) <= SLIDE_AREA * 0.12;
  }
  return false;
}

function isSlideChromeElement(member: IndexedElement): boolean {
  const { bounds, element } = member;
  const inTopChrome = bounds.y <= 0.85;

  if (inTopChrome) {
    if (
      element.type === "image" ||
      element.type === "svg" ||
      element.type === "line"
    ) {
      return bounds.w <= 4.6 && bounds.h <= 0.35;
    }
    if (element.type === "rectangle" || element.type === "ellipse") {
      return bounds.w <= 2.6 && bounds.h <= 0.5;
    }
  }

  if (element.type === "text") {
    const font = elementFont(element);
    const text = textContent(element).trim();
    const inHeader = bounds.y <= 0.9;
    const inFooter = bounds.y >= SLIDE_H - 0.55;
    const titleSized = font.size >= 24 || (font.bold === true && font.size >= 20);
    if (inTopChrome && bounds.h <= 0.36 && font.size <= 18) return true;
    if (inHeader && titleSized && text.length >= 2) return true;
    if (inFooter && font.size <= 14) return true;
  }

  const thinHorizontal = bounds.h <= 0.12 && bounds.w >= 0.5;
  const thinVertical = bounds.w <= 0.08 && bounds.h >= 0.5;
  if ((element.type === "line" || element.type === "rectangle") && bounds.y <= SLIDE_H * 0.3) {
    return thinHorizontal || thinVertical;
  }

  return false;
}

function bestGridPatternMembers(
  members: IndexedElement[],
): IndexedElement[] | null {
  const sets = layoutMemberSets(members);
  return (
    sets
      .filter(isReusableGridPattern)
      .sort(
        (a, b) =>
          layoutPatternMemberScore(b) - layoutPatternMemberScore(a) ||
          a[0]!.index - b[0]!.index,
      )[0] ?? null
  );
}

function bestFlexPatternMembers(
  members: IndexedElement[],
): IndexedElement[] | null {
  const sets = layoutMemberSets(members);
  return (
    sets
      .filter(isReusableFlexPattern)
      .sort(
        (a, b) =>
          layoutPatternMemberScore(b) - layoutPatternMemberScore(a) ||
          a[0]!.index - b[0]!.index,
      )[0] ?? null
  );
}

function layoutMemberSets(members: IndexedElement[]): IndexedElement[][] {
  const sets: IndexedElement[][] = [];
  const seen = new Set<string>();
  const push = (items: IndexedElement[]) => {
    if (items.length < 2 || items.length > MAX_ELEMENTS_PER_TEMPLATE) return;
    const sorted = [...items].sort((a, b) => a.index - b.index);
    const key = sorted.map(({ index }) => index).join(",");
    if (seen.has(key)) return;
    seen.add(key);
    sets.push(sorted);
  };

  push(members);

  const visualOrder = [...members].sort(
    (a, b) => a.bounds.y - b.bounds.y || a.bounds.x - b.bounds.x,
  );
  if (visualOrder.length > MAX_ELEMENTS_PER_TEMPLATE) {
    for (let start = 0; start <= visualOrder.length - 4; start += 1) {
      push(visualOrder.slice(start, start + MAX_ELEMENTS_PER_TEMPLATE));
    }
  }

  const allBounds = boundsForElements(members.map(({ element }) => element));
  const rowBands = groupMembersByBand(
    members,
    ({ bounds }) => bounds.y,
    Math.max(0.12, allBounds.h * 0.08),
  );
  const columnBands = groupMembersByBand(
    members,
    ({ bounds }) => bounds.x,
    Math.max(0.16, allBounds.w * 0.08),
  );

  rowBands.forEach(({ items }) => push(items));
  columnBands.forEach(({ items }) => push(items));

  return sets;
}

function isReusableGridPattern(members: IndexedElement[]): boolean {
  if (members.length < 4 || members.length > MAX_ELEMENTS_PER_TEMPLATE) return false;
  const elements = members.map(({ element }) => element);
  if (!hasReusableContent(elements, 3)) return false;

  const bounds = boundsForElements(elements);
  const area = bounds.w * bounds.h;
  if (area < MIN_GROUP_AREA || area > MAX_LAYOUT_PATTERN_AREA) return false;
  if (!looksGridLike(elements, bounds)) return false;

  const columnBands = groupMembersByBand(
    members,
    ({ bounds: box }) => box.x,
    Math.max(0.16, bounds.w * 0.08),
  );
  const rowBands = groupMembersByBand(
    members,
    ({ bounds: box }) => box.y,
    Math.max(0.12, bounds.h * 0.08),
  );
  const populatedColumns = columnBands.filter(({ items }) => items.length >= 2).length;
  const populatedRows = rowBands.filter(({ items }) => items.length >= 2).length;
  return populatedColumns >= 2 && populatedRows >= 2;
}

function isReusableFlexPattern(members: IndexedElement[]): boolean {
  if (members.length < 2 || members.length > MAX_ELEMENTS_PER_TEMPLATE) return false;
  const elements = members.map(({ element }) => element);
  if (!hasReusableContent(elements, 2)) return false;

  const bounds = boundsForElements(elements);
  const area = bounds.w * bounds.h;
  if (area < MIN_GROUP_AREA * 0.35 || area > MAX_LAYOUT_PATTERN_AREA) return false;
  if (!looksFlexLike(elements, bounds)) return false;

  const rowLike = bounds.w >= bounds.h;
  const crossBands = groupMembersByBand(
    members,
    ({ bounds: box }) => rowLike ? box.y + box.h / 2 : box.x + box.w / 2,
    rowLike ? Math.max(0.12, bounds.h * 0.24) : Math.max(0.16, bounds.w * 0.24),
  );
  return crossBands.length <= 2;
}

function hasReusableContent(elements: SlideElement[], minimum: number): boolean {
  const count = elements.filter((element) => {
    if (element.type === "text") return textContent(element).trim().length > 0;
    if (element.type === "text-list") return textListStrings(element).length > 0;
    return (
      element.type === "image" ||
      element.type === "svg" ||
      element.type === "chart" ||
      element.type === "table"
    );
  }).length;
  return count >= minimum;
}

function layoutPatternMemberScore(members: IndexedElement[]): number {
  return layoutPatternScore(members.map(({ element }) => element));
}

function layoutPatternScore(elements: SlideElement[]): number {
  const bounds = boundsForElements(elements);
  const columns = inferGridColumns(elements);
  const rows = inferGridRows(elements);
  const repeatBonus = Math.min(120, Math.max(columns, rows) * 18 + elements.length * 4);
  const compactnessBonus = Math.max(0, 35 - (bounds.w * bounds.h) / SLIDE_AREA * 35);
  return repeatBonus + compactnessBonus;
}

function layoutPatternCategory(
  elements: SlideElement[],
  structure: "flex" | "grid",
): DesignElementCategory {
  const classified = classifyElements(elements);
  if (
    classified === "media-card" ||
    classified === "image-asset" ||
    classified === "chart" ||
    classified === "table"
  ) {
    return classified;
  }
  if (structure === "grid") return "content-card";
  return classified === "unknown" || classified === "decorative"
    ? "content-card"
    : classified;
}

function groupMembersByBand<T>(
  items: T[],
  valueForItem: (item: T) => number,
  tolerance: number,
): Array<{ center: number; items: T[] }> {
  const bands: Array<{ center: number; items: T[] }> = [];

  for (const item of [...items].sort((a, b) => valueForItem(a) - valueForItem(b))) {
    const value = valueForItem(item);
    const existing = bands.find((band) => Math.abs(value - band.center) <= tolerance);
    if (existing) {
      existing.items.push(item);
      existing.center =
        existing.items.reduce((sum, bandItem) => sum + valueForItem(bandItem), 0) /
        existing.items.length;
    } else {
      bands.push({ center: value, items: [item] });
    }
  }

  return bands;
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

function dataElementCandidates(deck: Deck): Candidate[] {
  const candidates: Candidate[] = [];

  deck.slides.forEach((slide, slideIndex) => {
    slide.elements.forEach((element, elementIndex) => {
      if (element.type !== "chart" && element.type !== "table") return;
      if (element.opacity === 0) return;
      if (!isReusableDataElement(element)) return;

      const categoryHint: DesignElementCategory =
        element.type === "chart" ? "chart" : "table";
      candidates.push(makeCandidate({
        key: `imported-${element.type}-${slideIndex + 1}-${elementIndex + 1}`,
        label: labelFromElements(
          [element],
          element.type === "chart" ? "Chart" : "Table",
        ),
        description: `${
          element.type === "chart" ? "Chart" : "Table"
        } design element extracted from imported slide ${slideIndex + 1}.`,
        elements: [element],
        source: "data",
        slideIndex,
        elementIndexes: [elementIndex],
        categoryHint,
        score: 760 + dataElementComplexityScore(element),
        signature: `data:${element.type}:${dataElementSignature(element)}`,
      }));
    });
  });

  return candidates;
}

function isReusableDataElement(element: SlideElement): boolean {
  if (element.type !== "chart" && element.type !== "table") return false;
  const areaRatio = elementArea(element) / SLIDE_AREA;
  return areaRatio >= 0.008 && areaRatio <= 0.68;
}

function dataElementComplexityScore(element: SlideElement): number {
  if (element.type === "chart") {
    return Math.min(130, element.data.length * 12 + (element.title ? 28 : 0));
  }
  if (element.type === "table") {
    return Math.min(
      150,
      element.columns.length * 12 + element.rows.length * 10 + tableText(element).length / 12,
    );
  }
  return 0;
}

function dataElementSignature(element: SlideElement): string {
  if (element.type === "chart") {
    return [
      element.chartType,
      normalizeColor(chartColor(element)),
      element.data.length,
      element.data.map((datum) => datum.label).join("|"),
    ].join(":");
  }
  if (element.type === "table") {
    return [
      element.columns.length,
      element.rows.length,
      tableHeaderText(element),
      normalizeColor(fillColor(element.columns[0]?.fill, "")),
    ].join(":");
  }
  return element.type;
}

function pinnedDataCandidateForCluster(
  cluster: DesignElementCandidateCluster,
): Candidate | null {
  return (
    cluster.candidates.find(isPinnedDataCandidate) ??
    (isPinnedDataCandidate(cluster.representative) ? cluster.representative : null)
  );
}

function isPinnedDataCandidate(candidate: Candidate): boolean {
  if (candidate.source !== "data" || candidate.elements.length !== 1) return false;
  const [element] = candidate.elements;
  return element?.type === "chart" || element?.type === "table";
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
  const slottedCandidate = candidateWithTemplateSlots(candidate);
  if (
    slottedCandidate.elements.length === 1 &&
    (slottedCandidate.categoryHint === "image-asset" ||
      slottedCandidate.categoryHint === "chart" ||
      slottedCandidate.categoryHint === "table")
  ) {
    return withTemplateMetadata(slottedCandidate.elements, componentId, description);
  }

  const structure = resolveTemplateStructure(slottedCandidate, requestedStructure);
  const element = withTemplateMetadata(
    [semanticElementForCandidate(slottedCandidate, structure)],
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
  const intentElement = intentTemplateElement(candidate);
  if (intentElement) return intentElement;
  if (structure === "grid") return gridTemplateElement(candidate);
  if (structure === "flex") return flexTemplateElement(candidate);
  return groupTemplateElement(candidate);
}

function candidateWithTemplateSlots(candidate: Candidate): Candidate {
  const slotByIndex = componentSlotByElementIndex(candidate.slots);
  if (slotByIndex.size === 0) return candidate;

  return {
    ...candidate,
    elements: candidate.elements.map((element, index) => {
      const componentSlot = slotByIndex.get(index);
      if (!componentSlot) return element;
      const copy = cloneElement(element);
      copy.componentSlot = componentSlot;
      return copy;
    }),
  };
}

function componentSlotByElementIndex(
  slots: DesignElementSlot[],
): Map<number, string> {
  const used = new Set<string>();
  const byIndex = new Map<number, string>();

  for (const slot of slots) {
    const componentSlot = uniqueComponentSlotKey(componentSlotKey(slot), used);
    for (const index of slot.elementIndexes) {
      if (!byIndex.has(index)) byIndex.set(index, componentSlot);
    }
  }

  return byIndex;
}

function componentSlotKey(slot: DesignElementSlot): string {
  const raw = slot.name.trim() || slot.kind;
  const key = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return key || slot.kind;
}

function uniqueComponentSlotKey(base: string, used: Set<string>): string {
  let next = base;
  let suffix = 2;
  while (used.has(next)) {
    next = `${base}-${suffix}`;
    suffix += 1;
  }
  used.add(next);
  return next;
}

function intentTemplateElement(candidate: Candidate): SlideElement | null {
  if (candidate.intentHint === "title-lockup") {
    return flexTemplateElementForDirection(candidate, "column", "flex-start");
  }

  if (
    candidate.intentHint === "metric-card" ||
    candidate.intentHint === "stat-card" ||
    candidate.intentHint === "content-card"
  ) {
    return flexTemplateElementForDirection(candidate, "column", "flex-start");
  }

  if (candidate.intentHint === "author-pill" || candidate.intentHint === "icon-label-row") {
    return flexTemplateElementForDirection(candidate, "row", "center");
  }

  if (candidate.intentHint === "feature-list") {
    return flexTemplateElementForDirection(candidate, "column", "flex-start");
  }

  if (candidate.intentHint === "insight-grid") return gridTemplateElement(candidate);

  return null;
}

function resolveTemplateStructure(
  candidate: Candidate,
  requested?: DesignElementStructure,
): DesignElementStructure {
  const structureRequest = requested ?? candidate.structureHint;
  const recommended = recommendedStructureForCandidate(candidate);
  if (recommended === "container") return "container";
  if (structureRequest === "container" && findContainerShellIndex(candidate.elements, candidate.bounds) >= 0) {
    return "container";
  }
  if (
    structureRequest === "grid" &&
    canUseGridStructure(candidate.elements) &&
    looksGridLike(candidate.elements, candidate.bounds)
  ) {
    return "grid";
  }
  if (
    structureRequest === "flex" &&
    canUseFlexStructure(candidate.elements) &&
    looksFlexLike(candidate.elements, candidate.bounds)
  ) {
    return "flex";
  }
  if (structureRequest === "group") return "group";
  return recommended;
}

function recommendedStructureForCandidate(
  candidate: Pick<Candidate, "elements" | "bounds" | "categoryHint">,
): DesignElementStructure {
  if (findContainerShellIndex(candidate.elements, candidate.bounds) >= 0) {
    return "container";
  }
  if (canUseGridStructure(candidate.elements) && looksGridLike(candidate.elements, candidate.bounds)) return "grid";
  if (canUseFlexStructure(candidate.elements) && looksFlexLike(candidate.elements, candidate.bounds)) return "flex";
  return "group";
}

function groupTemplateElement(candidate: Candidate): SlideElement {
  return {
    type: "group",
    position: { x: safeGeometry(candidate.bounds.x), y: safeGeometry(candidate.bounds.y) },
    size: {
      width: safeWidth(candidate.bounds.w),
      height: safeHeight(candidate.bounds.h),
    },
    children: relativeElements(candidate.elements, candidate.bounds),
  };
}

function flexTemplateElement(candidate: Candidate): SlideElement {
  const direction = candidate.bounds.w >= candidate.bounds.h ? "row" : "column";
  return flexTemplateElementForDirection(
    candidate,
    direction,
    direction === "row" ? "center" : "flex-start",
  );
}

function flexTemplateElementForDirection(
  candidate: Candidate,
  direction: "row" | "column",
  alignItems: NonNullable<Extract<SlideElement, { type: "flex" }>["alignItems"]>,
): SlideElement {
  const structured = structuredFlexChildrenForCandidate(candidate, direction);
  const ordered = orderElementsForDirection(candidate.elements, direction);
  return {
    ...groupFrame(candidate.bounds),
    type: "flex",
    direction,
    alignItems,
    justifyContent: "flex-start",
    gap: structured?.gap ?? inferFlexGap(candidate.elements, candidate.bounds, direction),
    children: structured?.children ?? relativeElements(ordered, candidate.bounds),
  };
}

function gridTemplateElement(candidate: Candidate): SlideElement {
  const structured = structuredGridChildrenForCandidate(candidate);
  return {
    ...groupFrame(candidate.bounds),
    type: "grid",
    columns: structured?.columns ?? inferGridColumns(candidate.elements),
    rows: structured?.rows ?? inferGridRows(candidate.elements),
    gap: structured ? 0 : inferGridGap(candidate.elements, candidate.bounds),
    columnGap: structured?.columnGap,
    rowGap: structured?.rowGap,
    alignItems: "flex-start",
    justifyItems: "flex-start",
    children: structured?.children ?? relativeElements(candidate.elements, candidate.bounds),
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
      ? semanticContainerChild(candidate, childElements, shellBounds)
      : undefined;

  return {
    type: "container",
    position: { x: safeGeometry(shellBounds.x), y: safeGeometry(shellBounds.y) },
    size: {
      width: safeWidth(shellBounds.w),
      height: safeHeight(shellBounds.h),
    },
    fill: fillWithElementOpacity(shell.fill, shell.opacity),
    stroke: strokeWithElementOpacity(shell.stroke, shell.opacity),
    borderRadius: shell.borderRadius,
    shadow: shell.shadow,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    child,
  };
}

function semanticContainerChild(
  candidate: Candidate,
  childElements: SlideElement[],
  shellBounds: Bounds,
): SlideElement {
  const childCandidate: Candidate = {
    ...candidate,
    elements: childElements,
    bounds: shellBounds,
  };

  const gridChild =
    candidate.intentHint === "insight-grid" &&
    childElements.length >= 4 &&
    looksGridLike(childElements, shellBounds)
      ? gridTemplateElement(childCandidate)
      : null;
  if (gridChild) return semanticChildInFrame(gridChild, shellBounds);

  const direction = containerChildDirection(candidate.intentHint);
  if (direction) {
    return semanticChildInFrame(
      flexTemplateElementForDirection(
        childCandidate,
        direction,
        direction === "row" ? "center" : "flex-start",
      ),
      shellBounds,
    );
  }

  return {
    type: "group",
    position: { x: 0, y: 0 },
    size: {
      width: safeWidth(shellBounds.w),
      height: safeHeight(shellBounds.h),
    },
    children: relativeElements(childElements, shellBounds),
  };
}

function semanticChildInFrame(element: SlideElement, frame: Bounds): SlideElement {
  return {
    ...element,
    position: { x: 0, y: 0 },
    size: {
      width: safeWidth(frame.w),
      height: safeHeight(frame.h),
    },
  } as SlideElement;
}

function containerChildDirection(
  intent: DesignElementIntent,
): "row" | "column" | null {
  if (intent === "author-pill" || intent === "icon-label-row") return "row";
  if (
    intent === "title-lockup" ||
    intent === "metric-card" ||
    intent === "stat-card" ||
    intent === "content-card" ||
    intent === "feature-list"
  ) {
    return "column";
  }
  return null;
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
      width: safeWidth(bounds.w),
      height: safeHeight(bounds.h),
    },
  };
}

function relativeElements(elements: SlideElement[], bounds: Bounds): SlideElement[] {
  return elements.map((element) => relativeElement(element, bounds));
}

function orderElementsForDirection(
  elements: SlideElement[],
  direction: "row" | "column",
): SlideElement[] {
  return [...elements].sort((a, b) => {
    const aBox = elementBounds(a);
    const bBox = elementBounds(b);
    return direction === "row"
      ? aBox.x - bBox.x || aBox.y - bBox.y
      : aBox.y - bBox.y || aBox.x - bBox.x;
  });
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
      width: safeWidth(box.w),
      height: safeHeight(box.h),
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

type StructuredGridChildren = {
  children: SlideElement[];
  columnGap: number;
  columns: number;
  rowGap: number;
  rows: number;
};

type StructuredFlexChildren = {
  children: SlideElement[];
  gap: number;
};

function structuredGridChildrenForCandidate(
  candidate: Candidate,
): StructuredGridChildren | null {
  const elements = candidate.elements;
  if (elements.length < 4) return null;

  const columns = groupMembersByBand(
    elements,
    (element) => elementBounds(element).x,
    Math.max(0.16, candidate.bounds.w * 0.08),
  ).sort((a, b) => a.center - b.center);
  if (columns.length < 2 || columns.length > 6) return null;

  const yBands = groupMembersByBand(
    elements,
    (element) => elementBounds(element).y,
    Math.max(0.12, candidate.bounds.h * 0.08),
  ).sort((a, b) => a.center - b.center);
  if (yBands.length < 2) return null;

  const rowBandGroups = groupedSequentialBands(yBands);
  const rows = rowBandGroups.length;
  if (rows < 2 || rows > 8) return null;

  const cells = rowBandGroups.flatMap((rowBands, row) =>
    columns.map((column, columnIndex) => {
      const rowItems = new Set(rowBands.flatMap((band) => band.items));
      const items = column.items.filter((element) => rowItems.has(element));
      return { column: columnIndex, row, items };
    }),
  );
  if (cells.length < 4 || cells.some((cell) => cell.items.length === 0)) {
    return null;
  }

  const columnBoxes = columns.map((column) => boundsForElements(column.items));
  const rowBoxes = rowBandGroups.map((rowBands) =>
    boundsForElements(rowBands.flatMap((band) => band.items)),
  );
  const columnGap = inferredBandGap(columnBoxes, candidate.bounds.w, "x");
  const rowGap = inferredBandGap(rowBoxes, candidate.bounds.h, "y");
  const columnWidth = inferredBandSize(columnBoxes, candidate.bounds.w, columnGap, "x");
  const rowHeight = inferredBandSize(rowBoxes, candidate.bounds.h, rowGap, "y");

  return {
    columns: columns.length,
    rows,
    columnGap,
    rowGap,
    children: cells.map((cell) => {
      const cellFrame = {
        x: candidate.bounds.x + cell.column * (columnWidth + columnGap),
        y: candidate.bounds.y + cell.row * (rowHeight + rowGap),
        w: columnWidth,
        h: rowHeight,
      };
      return semanticCellGroup(cell.items, cellFrame, candidate.bounds);
    }),
  };
}

function structuredFlexChildrenForCandidate(
  candidate: Candidate,
  direction: "row" | "column",
): StructuredFlexChildren | null {
  const elements = candidate.elements;
  if (elements.length < 3) return null;

  const bands = groupMembersByBand(
    elements,
    (element) => {
      const box = elementBounds(element);
      return direction === "row" ? box.x : box.y;
    },
    direction === "row"
      ? Math.max(0.16, candidate.bounds.w * 0.08)
      : Math.max(0.12, candidate.bounds.h * 0.08),
  ).sort((a, b) => a.center - b.center);
  if (bands.length < 2 || bands.every((band) => band.items.length === 1)) {
    return null;
  }

  const boxes = bands.map((band) => boundsForElements(band.items));
  const available = direction === "row" ? candidate.bounds.w : candidate.bounds.h;
  const gap = inferredBandGap(boxes, available, direction === "row" ? "x" : "y");

  return {
    gap,
    children: bands.map((band) =>
      semanticCellGroup(band.items, boundsForElements(band.items), candidate.bounds),
    ),
  };
}

function semanticCellGroup(
  elements: SlideElement[],
  bounds: Bounds,
  parentBounds: Bounds,
): SlideElement {
  return {
    type: "group",
    position: {
      x: safeGeometry(bounds.x - parentBounds.x),
      y: safeGeometry(bounds.y - parentBounds.y),
    },
    size: {
      width: safeWidth(bounds.w),
      height: safeHeight(bounds.h),
    },
    children: relativeElements(elements, bounds),
  };
}

function groupedSequentialBands<T>(
  bands: Array<{ center: number; items: T[] }>,
): Array<Array<{ center: number; items: T[] }>> {
  if (bands.length <= 2) return bands.map((band) => [band]);

  const gaps = bands.slice(1).map((band, index) => {
    const previous = bands[index];
    return previous ? band.center - previous.center : 0;
  });
  const medianGap = median(gaps.filter((gap) => gap > 0));
  const splitThreshold = Math.max(0.22, medianGap * 1.25);
  const groups: Array<Array<{ center: number; items: T[] }>> = [[bands[0]!]];

  gaps.forEach((gap, index) => {
    const nextBand = bands[index + 1];
    if (!nextBand) return;
    if (gap >= splitThreshold) {
      groups.push([nextBand]);
    } else {
      groups[groups.length - 1]?.push(nextBand);
    }
  });

  return groups;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
    : sorted[mid] ?? 0;
}

function inferredBandGap(
  boxes: Bounds[],
  available: number,
  axis: "x" | "y",
): number {
  if (boxes.length <= 1) return 0;
  const ordered = [...boxes].sort((a, b) =>
    axis === "x" ? a.x - b.x || a.y - b.y : a.y - b.y || a.x - b.x,
  );
  const rawGaps = ordered
    .slice(1)
    .map((box, index) => {
      const previous = ordered[index];
      if (!previous) return 0;
      return axis === "x"
        ? Math.max(0, box.x - (previous.x + previous.w))
        : Math.max(0, box.y - (previous.y + previous.h));
    })
    .filter((gap) => gap > 0.01);
  if (rawGaps.length > 0) {
    return safeGeometry(rawGaps.reduce((sum, gap) => sum + gap, 0) / rawGaps.length);
  }

  const averageSize =
    boxes.reduce((sum, box) => sum + (axis === "x" ? box.w : box.h), 0) /
    boxes.length;
  return safeGeometry(Math.max(0, (available - averageSize * boxes.length) / (boxes.length - 1)));
}

function inferredBandSize(
  boxes: Bounds[],
  available: number,
  gap: number,
  axis: "x" | "y",
): number {
  if (boxes.length === 0) {
    return safeSize(available, axis === "x" ? SLIDE_W : SLIDE_H);
  }
  const layoutSize = (available - gap * Math.max(0, boxes.length - 1)) / boxes.length;
  const averageBoxSize =
    boxes.reduce((sum, box) => sum + (axis === "x" ? box.w : box.h), 0) /
    boxes.length;
  return safeSize(
    Math.max(0.01, Math.max(layoutSize, averageBoxSize)),
    axis === "x" ? SLIDE_W : SLIDE_H,
  );
}

function canUseGridStructure(elements: SlideElement[]): boolean {
  if (hasMixedShapeTextPattern(elements)) return false;
  return true;
}

function canUseFlexStructure(elements: SlideElement[]): boolean {
  if (hasMixedShapeTextPattern(elements)) return false;
  return true;
}

function hasMixedShapeTextPattern(elements: SlideElement[]): boolean {
  const shapeCount = elements.filter(
    (element) =>
      element.type === "rectangle" ||
      element.type === "ellipse" ||
      element.type === "line",
  ).length;
  const textCount = elements.filter(
    (element) => element.type === "text" || element.type === "text-list",
  ).length;
  if (shapeCount > 0 && textCount > 0) {
    return shapeCount / elements.length >= 0.25;
  }
  return false;
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
  const xStartBands = bandCount(
    boxes.map((box) => box.x),
    Math.max(0.16, bounds.w * 0.08),
  );
  const yStartBands = bandCount(
    boxes.map((box) => box.y),
    Math.max(0.12, bounds.h * 0.08),
  );
  const xCenterBands = bandCount(
    boxes.map((box) => box.x + box.w / 2),
    Math.max(0.16, bounds.w * 0.08),
  );
  const yCenterBands = bandCount(
    boxes.map((box) => box.y + box.h / 2),
    Math.max(0.12, bounds.h * 0.08),
  );
  return (
    Math.max(xStartBands, xCenterBands) >= 2 &&
    Math.max(yStartBands, yCenterBands) >= 2
  );
}

function inferGridColumns(elements: SlideElement[]): number {
  const boxes = elements.map(elementBounds);
  const bounds = boundsForElements(elements);
  return Math.max(
    1,
    Math.min(
      6,
      bandCount(
        boxes.map((box) => box.x),
        Math.max(0.16, bounds.w * 0.08),
      ),
    ),
  );
}

function inferGridRows(elements: SlideElement[]): number {
  const boxes = elements.map(elementBounds);
  const bounds = boundsForElements(elements);
  return Math.max(
    1,
    Math.min(
      12,
      bandCount(
        boxes.map((box) => box.y),
        Math.max(0.12, bounds.h * 0.08),
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

function safeWidth(value: number): number {
  return safeSize(value, SLIDE_W);
}

function safeHeight(value: number): number {
  return safeSize(value, SLIDE_H);
}

function safeSize(value: number, max = SLIDE_W): number {
  return Math.min(max, Math.max(0.01, Math.round(value * 10_000) / 10_000));
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
  if (
    candidate.type !== "rectangle" &&
    candidate.type !== "ellipse" &&
    candidate.type !== "image" &&
    candidate.type !== "line"
  ) {
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

  const chart = elements.find(
    (element): element is Extract<SlideElement, { type: "chart" }> =>
      element.type === "chart",
  );
  if (chart) {
    const chartLabel = chart.title?.trim() || chart.data[0]?.label;
    if (chartLabel) return `${fallback}: ${truncate(chartLabel, 42)}`;
  }

  const table = elements.find(
    (element): element is Extract<SlideElement, { type: "table" }> =>
      element.type === "table",
  );
  if (table) {
    const tableLabel = tableHeaderText(table) || table.rows[0]?.[0]?.text;
    if (tableLabel) return `${fallback}: ${truncate(tableLabel, 42)}`;
  }

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
  if (element.data) return `data-${sampleHash(element.data)}`;
  if (element.name?.trim()) return `name-${slugify(element.name)}`;
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
  const chartCount = elements.filter((element) => element.type === "chart").length;
  const tableCount = elements.filter((element) => element.type === "table").length;
  const shapeCount = elements.filter(
    (element) =>
      element.type === "rectangle" ||
      element.type === "ellipse" ||
      element.type === "line",
  ).length;

  if (elements.length === 1 && elements[0]?.type === "image") return "image-asset";
  if (chartCount > 0) return "chart";
  if (tableCount > 0) return "table";
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
  const trimmed = text.trim();
  if (/(?:\$|€|£|¥|%|\b\d+(?:\.\d+)?x\b)/i.test(trimmed)) return true;
  const numeric = trimmed.replace(/,/g, "");
  if (!/^[+-]?\d+(?:\.\d+)?$/.test(numeric)) return false;
  return !/^20\d{2}$/.test(numeric);
}

function compatibleCategories(
  a: DesignElementCategory,
  b: DesignElementCategory,
): boolean {
  const families: DesignElementCategory[][] = [
    ["navigation", "badge", "cta"],
    ["content-card", "media-card", "stat-card"],
    ["chart", "table", "stat-card", "content-card"],
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
  if (element.type === "chart") return `${element.chartType} chart`;
  if (element.type === "table") return "data table";
  return element.type;
}

function textContentForSummary(element: SlideElement): string {
  if (element.type === "text") return textContent(element);
  if (element.type === "text-list") return textListStrings(element).join(" / ");
  if (element.type === "chart") return chartText(element);
  if (element.type === "table") return tableText(element);
  return "";
}

function chartText(element: Extract<SlideElement, { type: "chart" }>): string {
  return oneLine(
    [
      element.title,
      ...element.data.map((datum) => `${datum.label} ${datum.value}`),
    ]
      .filter(Boolean)
      .join(" / "),
  );
}

function tableText(element: Extract<SlideElement, { type: "table" }>): string {
  return oneLine(
    [
      tableHeaderText(element),
      ...element.rows
        .slice(0, 3)
        .map((row) => row.map((cell) => cell.text ?? "").filter(Boolean).join(" / ")),
    ]
      .filter(Boolean)
      .join(" / "),
  );
}

function tableHeaderText(element: Extract<SlideElement, { type: "table" }>): string {
  return oneLine(
    element.columns
      .map((cell) => cell.text ?? "")
      .filter(Boolean)
      .join(" / "),
  );
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
    case "chart":
    case "table":
      return 90;
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
    case "chart":
      return "Chart";
    case "table":
      return "Table";
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

function clampQuality(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
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
