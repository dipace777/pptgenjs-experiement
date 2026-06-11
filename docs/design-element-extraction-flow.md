# Design Element Extraction Flow

This document walks through design element extraction in the order it happens at runtime. It is meant to be read as a story: a PPTX comes in, the importer turns it into a typed deck, extraction finds candidate reusable parts, clustering groups repeated design language, and the editor drawer receives insertable templates.

For the shorter reference doc, see [design-elements.md](./design-elements.md).

## End-To-End Sequence

```txt
PPTX file
  -> importPptxFile()
  -> DeckSchema.safeParse()
  -> createDesignElementExtraction(deck)
       -> candidate discovery
       -> candidate repair and expansion
       -> overlap pruning
       -> agglomerative clustering
       -> deterministic templates
       -> curationInput for AI
  -> curateDesignElementsWithAi(curationInput)
  -> templatesFromDesignElementCuration(extraction, curation)
  -> savePreviewDeck(deck, componentTemplates)
  -> preview/editor
  -> drawer "+ Design Element"
  -> prepareDesignElementsForInsertion()
```

The main production rule is:

```txt
The extractor may reuse imported elements, but it must not invent slide geometry.
```

AI curation can rename, drop, keep, describe, and suggest a semantic structure. It does not create coordinates or new visual elements.

## 1. PPTX Import

The user selects a PPTX in [generate.tsx](../src/routes/generate.tsx). The import handler calls:

```ts
const { deck: importedDeck, warnings } = await importPptxFile(pptxFile, {
  preferSidecar: false,
});
```

At this point the deck is already converted into the canonical schema shape:

```ts
type Deck = {
  title: string;
  slides: Slide[];
  theme?: DeckTheme | null;
};

type Slide = {
  background: string;
  elements: SlideElement[];
};
```

Example imported slide elements might look like this:

```ts
[
  {
    type: "rectangle",
    position: { x: 0.9, y: 3.1 },
    size: { width: 2.8, height: 1.1 },
    fill: { color: "F8FAFC" },
  },
  {
    type: "text",
    position: { x: 1.1, y: 3.25 },
    size: { width: 2.2, height: 0.35 },
    font: { family: "Inter", size: 18, color: "111827", bold: true },
    runs: [{ text: "Acquisition" }],
  },
  {
    type: "text",
    position: { x: 1.1, y: 3.7 },
    size: { width: 2.4, height: 0.35 },
    font: { family: "Inter", size: 13, color: "111827" },
    runs: [{ text: "Paid channels convert faster." }],
  },
]
```

These are still ordinary slide elements. Nothing is a reusable design element yet.

## 2. Deck Validation

The imported deck is validated before extraction:

```ts
const validated = DeckSchema.safeParse(importedDeck);
```

If validation fails, extraction does not run. This keeps the extractor from trying to reason about malformed element geometry.

Important schema guarantees after this step:

- every slide has a valid background color;
- element positions and sizes are within slide constraints;
- text runs, images, tables, charts, semantic wrappers, and shapes match the expected union type;
- the deck has at least one slide.

## 3. Extraction Entry Point

The import route calls:

```ts
const extraction = createDesignElementExtraction(validated.data);
```

The output is:

```ts
type DesignElementExtraction = {
  templates: ExtractedDesignElementTemplate[];
  candidates: DesignElementCandidate[];
  clusters: DesignElementCandidateCluster[];
  curationInput: DesignElementCurationInput;
  metrics: {
    rawCandidateCount: number;
    candidateCount: number;
    clusterCount: number;
  };
};
```

The `templates` array is the deterministic fallback. Even if AI curation is disabled or fails, the editor still has something usable.

## 4. Candidate Discovery

Candidate discovery is deterministic. It scans each slide and asks: "Which existing elements might be a reusable visual block?"

`createDesignElementExtraction()` gathers raw candidates from five sources.

### 4.1 Explicit Component Candidates

Function:

```ts
explicitComponentCandidates(deck)
```

What it finds:

Elements that already share a `componentId`, usually because they were previously tagged or generated as a reusable component.

Example:

```ts
[
  {
    type: "text",
    componentId: "imported-stat-card",
    componentInstanceId: "stat-card-1",
    runs: [{ text: "Launch metric" }],
  },
  {
    type: "text",
    componentId: "imported-stat-card",
    componentInstanceId: "stat-card-1",
    runs: [{ text: "42%" }],
  },
]
```

Candidate result:

```ts
{
  source: "explicit",
  label: "Stat Card",
  elementIndexes: [0, 1],
  categoryHint: "stat-card",
}
```

Why this source matters:

Explicit grouping is the strongest signal that a designer or previous system intended these elements to behave as one unit.

### 4.2 Container Candidates

Function:

```ts
containerGroupCandidates(deck)
```

What it finds:

A visible rectangle or ellipse that looks like a card/frame, plus meaningful elements inside it.

Example slide region:

```txt
+-----------------------------+
| Customer Story              |
| [photo] Faster onboarding   |
+-----------------------------+
```

Candidate elements:

```ts
[
  { type: "rectangle", fill: { color: "FFFFFF" } },
  { type: "text", runs: [{ text: "Customer Story" }] },
  { type: "image", name: "customer-photo" },
]
```

Likely classification:

```ts
{
  source: "container",
  categoryHint: "media-card",
  intentHint: "media-card",
}
```

Why this source matters:

Card shells are one of the clearest signs of reusable design. If a frame owns text/images, insertion should preserve the whole card, not just the text.

### 4.3 Layout Pattern Candidates

Function:

```ts
layoutPatternCandidates(deck)
```

What it finds:

Aligned repeated systems that do not have a visible card background.

Examples:

- a 2x3 agenda grid;
- three competitor cards aligned in columns;
- an icon + label row;
- a vertical list of numbered insights.

Before scanning layout patterns, the extractor removes likely slide chrome:

- full-slide backgrounds;
- large top titles;
- top header logos/rules;
- tiny footer text;
- repeated header pills.

Example:

```txt
TARGET AUDIENCE       04/19
MARKET OVERVIEW       07/19
COMPETITORS           12/19
CONTACT US            18/19
```

There may be no rectangle around this region, but the alignment itself is reusable. The extractor can produce:

```ts
{
  source: "layout-grid",
  categoryHint: "content-card",
  intentHint: "insight-grid",
  elements: [
    /* section labels and page number text elements */
  ],
}
```

Why this source matters:

Many modern decks use whitespace instead of boxes. Without this source, extraction would miss most reusable grids and rows.

### 4.4 Title Lockup Candidates

Function:

```ts
titleLockupCandidates(deck)
```

What it finds:

Heading text plus nearby accent shapes, underline rules, dots, small images, or supporting text.

Example:

```txt
ABOUT THE
BRAND  .

Presentations are communication tools...
```

Candidate result:

```ts
{
  source: "title-lockup",
  categoryHint: "title-lockup",
  intentHint: "title-lockup",
  elements: [
    headingText,
    accentDot,
    bodyText,
  ],
}
```

Why this source matters:

Title compositions are often reusable brand language. A heading plus accent is more useful than either piece alone.

### 4.5 Media Candidates

Function:

```ts
mediaCandidates(deck)
```

What it finds:

Standalone non-background images that are large enough to reuse.

Ignored:

- full-slide background photos;
- tiny image fragments;
- image assets that are too large and likely slide-specific.

Example:

```ts
{
  source: "media",
  label: "Image: Product Screenshot",
  categoryHint: "image-asset",
  elements: [{ type: "image", name: "Product Screenshot" }],
}
```

Why this source matters:

Imported decks often contain logos, screenshots, and photo treatments that users want to reuse directly.

## 5. Candidate Metadata

Every raw candidate is normalized through `makeCandidate()`.

It computes:

- `bounds`: union box around all candidate elements;
- `slots`: editable parts such as title, body, image, icon, metric, date, chart, table, or accent;
- `intentHint`: likely user-facing intent;
- `quality`: strengths, issues, and score;
- `clusterSignature`: fuzzy grouping fingerprint;
- final `score`: source score plus quality and intent bonuses.

Example candidate:

```ts
{
  id: "layout-grid-2-4-5-6-7-ab12",
  key: "grid-slide-2-region-1",
  label: "Content Grid: Target Audience",
  source: "layout-grid",
  slideIndex: 1,
  elementIndexes: [4, 5, 6, 7, 8, 9],
  categoryHint: "content-card",
  intentHint: "insight-grid",
  slots: [
    { kind: "label", name: "Label", elementIndexes: [0] },
    { kind: "label", name: "Label 2", elementIndexes: [1] },
  ],
  quality: {
    score: 88,
    strengths: ["captures a reusable repeated layout"],
    issues: [],
  },
}
```

## 6. Candidate Repair And Expansion

Function:

```ts
repairCandidates(deck, discoveredCandidates)
```

Candidate discovery is intentionally broad. It may find a useful fragment before it finds the complete component. Repair tries to complete the component using only nearby real imported elements.

### Example: Tagged Text Fragment

Initial raw candidate:

```txt
[Reusable card title]
```

Nearby slide region:

```txt
+------------------------+
| Reusable card title    |
+------------------------+
```

Repair adds the containing rectangle shell:

```ts
before.elements = [titleText]
after.elements = [rectangleShell, titleText]
```

Why:

The card is more reusable with its frame. It will also preserve color contrast better when inserted onto another slide.

### Example: Heading Accent

Initial raw candidate:

```txt
Q3 Highlights
```

Nearby accent:

```txt
Q3 Highlights
------------
```

Repair adds the underline:

```ts
after.elements = [headingText, underlineLine]
```

### Example: Icon And Label

Initial raw candidate:

```txt
[icon]
```

Nearby label:

```txt
[icon] Fast setup
```

Repair adds the label:

```ts
after.elements = [iconSvg, labelText]
```

Repair is conservative:

- image-only assets are not repaired;
- likely slide backgrounds are ignored;
- no new geometry is generated;
- candidate size is capped by `MAX_ELEMENTS_PER_TEMPLATE`;
- bounds, slots, intent, quality, score, and cluster signature are recomputed after repair.

## 7. Overlap Pruning

Function:

```ts
pruneOverlappingCandidates(rawCandidates)
```

Discovery and repair can create redundant candidates.

Example:

```txt
Candidate A: full card = [rectangle, title, body]
Candidate B: title fragment = [title]
Candidate C: repaired title = [rectangle, title]
```

The pruning pass compares candidates on the same slide using:

- exact signature and element indexes;
- spatial overlap;
- element-index overlap;
- category/type family;
- score difference.

If a richer candidate already covers the smaller one, the smaller one is dropped.

Result:

```txt
Keep: [rectangle, title, body]
Drop: [title]
Drop: [rectangle, title]
```

Why this matters:

Without pruning, the drawer would show several versions of the same visual block.

## 8. Clustering

Function:

```ts
clusterCandidates(candidates)
```

Clustering groups candidates that look like repeated design language across the whole deck.

The current implementation uses:

```ts
import { agnes } from "ml-hclust";
import { similarity as vectorSimilarity } from "ml-distance";
```

It builds an agglomerative clustering tree with:

```txt
distance = 1 - candidateSimilarity(a, b)
```

Then it cuts the dendrogram at a conservative threshold:

```txt
CLUSTER_DISTANCE_THRESHOLD = 0.22
```

This means candidates usually need about `0.78` similarity or better to merge.

### Similarity Signals

`candidateSimilarity()` combines:

- category compatibility;
- source agreement;
- intent agreement;
- element type sequence;
- normalized layout tokens;
- style tokens;
- size similarity;
- numeric feature-vector cosine similarity;
- text-token overlap;
- image identity checks.

Image assets have an important guard:

```txt
If two image candidates have different image data identities,
they do not cluster just because the imported name or geometry matches.
```

This prevents different images named "Image 2" from becoming one reusable asset.

### Feature Vector Example

A candidate feature vector includes:

- position and size as fractions of slide width/height;
- area ratio;
- aspect ratio;
- center point;
- element count;
- ratios of text, image, svg, shape, line, chart, table, and semantic wrapper elements;
- slot count;
- text slot count;
- icon slot flag;
- container shell flag;
- quality score;
- distinct style-token count;
- average font size;
- bold ratio;
- text length;
- high-value intent flag;
- one-hot category;
- one-hot source.

### Clustering Example

Slide 1:

```txt
+-----------------------------+
| Acquisition                 |
| Paid channels convert fast. |
+-----------------------------+
```

Slide 2:

```txt
+--------------------------------+
| Expansion                      |
| Existing accounts add seats.   |
+--------------------------------+
```

The exact fuzzy signatures may differ because the fill, text length, and dimensions differ. The feature vectors still say:

- same source;
- same intent;
- same element types;
- similar geometry;
- similar text hierarchy;
- similar card structure.

So they cluster as one repeated design pattern.

## 9. Cluster Scoring

Function:

```ts
clusterScore(cluster)
```

Cluster score is boosted by:

- representative candidate score;
- number of occurrences;
- number of unique slides;
- category bonus.

Repeated patterns float higher than one-off fragments.

Example:

```txt
Brand pill appears on slides 1-10
=> high occurrence bonus
=> high slide bonus
=> likely appears in drawer
```

## 10. Curation Input

Function:

```ts
buildCurationInput(deck, clusters)
```

This converts clusters into compact summaries for AI curation.

Example:

```ts
{
  deckTitle: "full-neon-presentation",
  slideCount: 19,
  clusters: [
    {
      id: "cluster-title-lockup-a1b2",
      representativeCandidateId: "title-lockup-3-1-2-3",
      label: "Title Lockup: About the Brand",
      categoryHint: "title-lockup",
      intentHint: "title-lockup",
      recommendedStructure: "group",
      occurrenceCount: 3,
      slideNumbers: [3, 7, 11],
      bounds: { x: 0.5, y: 0.7, w: 3.6, h: 1.2 },
      editableSlots: [
        { kind: "title", name: "Title", role: "heading text" },
        { kind: "accent", name: "Accent", role: "accent shape" },
      ],
      qualitySignals: ["clear title lockup intent"],
      qualityIssues: [],
    },
  ],
}
```

The payload is intentionally not full-fidelity slide JSON. It is a compact decision document for AI.

## 11. AI Curation

Function:

```ts
curateDesignElementsWithAi(curationInput)
```

The AI may return:

```ts
{
  clusterId: "cluster-title-lockup-a1b2",
  action: "keep",
  label: "Brand Title Lockup",
  description: "Large heading with accent dot and supporting body text.",
  intent: "title-lockup",
  structure: "group",
  confidence: 0.88,
}
```

AI can:

- keep a cluster;
- drop a cluster;
- rename it;
- describe it;
- choose a better representative candidate;
- suggest `group`, `container`, `flex`, or `grid`.

AI cannot:

- create a new element;
- move coordinates;
- invent geometry;
- reference IDs that do not exist.

If AI fails, deterministic templates are used.

## 12. Templates From Clusters

Function:

```ts
templatesFromDesignElementCuration(extraction, curation)
```

or fallback:

```ts
templatesFromClusters(clusters, limit)
```

Each template looks like:

```ts
{
  id: "title-lockup-about-the-brand",
  label: "Brand Title Lockup",
  description: "Large heading with accent dot and supporting body text.",
  intent: "title-lockup",
  qualityScore: 92,
  slots: [
    { kind: "title", name: "Title", elementIndexes: [0] },
    { kind: "accent", name: "Accent", elementIndexes: [1] },
  ],
  elements: [
    /* insertable SlideElement[] */
  ],
}
```

## 13. Template Structure

Function:

```ts
templateElementsForCandidate(candidate, id, description, requestedStructure)
```

The template builder decides how the selected candidate becomes insertable.

### Plain Image Asset

Input:

```ts
[{ type: "image", name: "Logo" }]
```

Output:

```ts
[{ type: "image", componentId: "image-logo", name: "Logo" }]
```

Single image assets stay plain.

### Container

Input:

```ts
[
  rectangleShell,
  titleText,
  bodyText,
]
```

Output:

```ts
{
  type: "container",
  fill: rectangleShell.fill,
  stroke: rectangleShell.stroke,
  child: {
    type: "group",
    children: [relativeTitleText, relativeBodyText],
  },
}
```

Use this when a visible shell owns the content.

### Grid

Input:

```txt
Label A    Label B
Value A    Value B
```

Output:

```ts
{
  type: "grid",
  columns: 2,
  rows: 2,
  children: [cellA, cellB, cellC, cellD],
}
```

Use this when there are populated row and column bands.

### Flex

Input:

```txt
[icon] Fast setup    [icon] Clear handoff
```

Output:

```ts
{
  type: "flex",
  direction: "row",
  children: [itemA, itemB],
}
```

Use this when elements form one clear row or column.

### Group

Input:

```txt
ABOUT THE
BRAND    .
```

Output:

```ts
{
  type: "group",
  children: [relativeHeading, relativeAccent],
}
```

Use this when the visual composition should remain exact.

## 14. Preview Storage

Function:

```ts
savePreviewDeck(deck, componentTemplates)
```

The preview handoff stores:

```ts
{
  deck,
  componentTemplates,
}
```

Storage validation keeps the imported deck even if an extracted template is invalid. Template validation is per-template, so one bad design element does not hide every design element in the drawer.

This prevents:

```txt
one invalid template
  -> full payload rejected
  -> preview falls back/misses componentTemplates
  -> drawer has no "+ Design Element"
```

## 15. Editor Drawer

The preview route passes templates to:

```tsx
<SlideEditor
  initialDeck={payload.deck}
  componentTemplates={payload.componentTemplates}
/>
```

The drawer shows `+ Design Element` only when:

```ts
componentTemplates.length > 0
```

Clicking a design element calls:

```ts
prepareDesignElementsForInsertion(component.elements, activeSlide.background)
```

This step:

1. clones the template elements;
2. centers them on the current slide;
3. adapts text color if the element has no visible surface and the target slide background would make text unreadable;
4. inserts the result into the active slide.

Example:

```txt
Floating dark text extracted from a light slide
  -> inserted onto a dark slide
  -> text recolored to light
```

But:

```txt
Dark text inside its own light card
  -> inserted onto a dark slide
  -> text stays dark because the card surface travels with it
```

## 16. Debugging Examples

### The Drawer Shows No Design Elements

Check:

1. Did `createDesignElementExtraction()` produce clusters?
2. Did `templatesFromDesignElementCuration()` produce templates?
3. Did `savePreviewDeck()` store valid `componentTemplates`?
4. Did preview receive `payload.componentTemplates`?

Relevant tests:

- [design-element-extraction.spec.ts](../src/lib/design-element-extraction.spec.ts)
- [deck-storage.spec.ts](../src/lib/deck-storage.spec.ts)

### A Design Element Inserts With Invisible Text

Likely cause:

```txt
The template was extracted without its original light/dark surface,
then inserted onto an opposite-color slide.
```

Fix path:

```txt
prepareDesignElementsForInsertion()
  -> checks whether the template has its own visible surface
  -> checks contrast against active slide background
  -> recolors floating text only when needed
```

Relevant test:

- [design-element-insertion.spec.ts](../src/lib/design-element-insertion.spec.ts)

### Similar Cards Do Not Cluster

Check:

1. Are they classified into compatible categories?
2. Do they have similar element type sequence?
3. Are style/layout tokens too different?
4. Does the feature vector say they are similar?
5. Is the distance above `CLUSTER_DISTANCE_THRESHOLD`?

Relevant test:

```txt
"clusters structurally similar cards even when their fuzzy signatures differ"
```

in [design-element-extraction.spec.ts](../src/lib/design-element-extraction.spec.ts).

## 17. What The AI Sees Vs What The Editor Inserts

AI sees compact cluster summaries:

```txt
label, category, intent, slots, quality, bounds, element summaries
```

Editor inserts real `SlideElement[]`:

```txt
actual text elements, images, shapes, containers, groups, grids, flex layouts
```

That separation is deliberate. The AI makes curation decisions; the deterministic extractor owns geometry and rendering fidelity.

