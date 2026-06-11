# Design Element Extraction

This document explains how imported PPTX decks become reusable design elements in the editor drawer.

For a step-by-step walkthrough with examples, see [design-element-extraction-flow.md](./design-element-extraction-flow.md).

The two main files are:

| File | Role |
| --- | --- |
| [src/lib/design-element-extraction.ts](../src/lib/design-element-extraction.ts) | Deterministic extraction, candidate scoring, clustering, template creation, and Zod schemas for AI curation. |
| [src/lib/design-element-curation-ai.ts](../src/lib/design-element-curation-ai.ts) | Server-only AI curation step that decides which deterministic clusters are worth showing to users. |

## Big Picture

Design element extraction happens only after a PPTX has already been imported into the canonical `Deck` shape.

```
PPTX file
  -> importPptxFile()
  -> DeckSchema.safeParse()
  -> createDesignElementExtraction(deck)
       -> candidate discovery
       -> candidate repair and expansion
       -> overlap pruning
       -> clustering
       -> deterministic template fallback
       -> curationInput for AI
  -> curateDesignElementsWithAi(curationInput)
  -> templatesFromDesignElementCuration(extraction, curation)
  -> saveAndPreview(deck, componentTemplates)
  -> editor drawer "+ Design Element"
```

The important production rule is: geometry comes from deterministic extraction. The AI can keep, drop, rename, describe, and suggest a structure, but it should not invent coordinates or elements.

## Runtime Path

The import flow lives in [src/routes/generate.tsx](../src/routes/generate.tsx).

1. `importPptxFile()` returns an imported `Deck`.
2. `DeckSchema.safeParse()` validates the deck.
3. `createDesignElementExtraction(validated.data)` builds deterministic candidates, clusters, templates, and an AI input payload.
4. The UI calls `curateDesignElementsWithAi()` if there are clusters to curate.
5. `templatesFromDesignElementCuration()` applies the AI decisions. If AI is disabled or fails, deterministic clustered templates are used.
6. `componentTemplates` are passed into preview/editor state and displayed in the edit drawer.

## Main Output

The drawer consumes `ExtractedDesignElementTemplate`:

```ts
{
  id: string;
  label: string;
  description?: string;
  elements: SlideElement[];
  intent?: DesignElementIntent;
  qualityScore?: number;
  slots?: DesignElementSlot[];
}
```

Each template is insertable. Most multi-element templates are wrapped as semantic elements:

| Structure | Use case |
| --- | --- |
| `container` | A clear frame/card/background shell owns the block. |
| `flex` | A simple row or column system, such as icon + label or navigation pill. |
| `grid` | Repeated rows and columns. |
| `group` | Exact freeform composition where layout should not be reinterpreted. |

Single image assets can stay as a plain `image` element.

## Extraction Stages

### 1. Candidate Discovery

`createDesignElementExtraction()` starts by collecting raw candidates from four deterministic sources.

| Source | Function | What it finds |
| --- | --- | --- |
| `explicit` | `explicitComponentCandidates()` | Existing runs of elements with the same `componentId`, usually already-tagged imported components. |
| `container` | `containerGroupCandidates()` | A visible rectangle/ellipse that looks like a card or frame, plus nearby elements inside it. |
| `layout-grid` / `layout-flex` | `layoutPatternCandidates()` | Aligned repeated content systems with no visible container shell, such as insight grids, icon rows, and column lists. |
| `title-lockup` | `titleLockupCandidates()` | Heading text plus nearby accent shapes/images. |
| `media` | `mediaCandidates()` | Non-background images that are large enough to be reusable assets. |

Each raw candidate includes:

- `elements`: the actual `SlideElement[]` from the imported slide.
- `slideIndex` and `elementIndexes`: where it came from.
- `categoryHint`: an initial deterministic classification.
- `score`: how useful it seems.
- `signature` and `clusterSignature`: fingerprints for deduping and grouping.
- `bounds`: the union box around the candidate.

### 2. Candidate Repair And Expansion

`repairCandidates()` runs before overlap pruning. Its job is to turn plausible fragments into complete reusable blocks while still using only real imported elements.

The repair pass can add:

- a containing shell around selected text or icons;
- meaningful contents inside a selected card/container shell;
- nearby underline/accent lines and shapes for headings;
- adjacent label/body text for icon-like elements;
- adjacent icon-like elements for selected text;
- supporting body/list text below title-like text.

The repair pass is conservative:

- it does not repair image-only assets;
- it never invents new geometry;
- it skips likely slide backgrounds;
- it respects `MAX_ELEMENTS_PER_TEMPLATE`;
- it recomputes bounds, intent, slots, quality, score, and clustering signature after repair.

This is the first production step toward better curation. The AI receives more complete candidates, so it has less pressure to infer missing pieces from partial geometry.

### 3. Overlap Pruning

`pruneOverlappingCandidates()` removes candidates that are likely the same thing on the same slide.

It compares:

- exact signature and element indexes;
- spatial overlap;
- element-index overlap;
- category or element type family;
- score difference.

This prevents the drawer from showing both a full card and tiny fragments of that same card when the richer block already exists.

### Layout Patterns Without Containers

`layoutPatternCandidates()` handles decks that use whitespace and alignment instead of card backgrounds.

It first removes slide chrome, such as:

- large title text near the top of the slide;
- top underline/accent rules;
- tiny footer text;
- full-slide backgrounds.

Then it looks for reusable aligned regions:

- `layout-grid` when multiple rows and columns are populated;
- `layout-flex` when elements form one clear row or column.

This is the path that turns a 2x3 “key insights” section into one semantic `grid` design element even though there is no rectangle around it.

### 4. Clustering

`clusterCandidates()` groups candidates that look like repeated design language across the deck.

The implementation uses `ml-hclust` agglomerative clustering over all candidates, instead of greedily assigning each candidate to the current best cluster. The distance is `1 - candidateSimilarity()`, and the dendrogram is cut at a conservative threshold so candidates only merge when the combined evidence is strong.

Similarity uses:

- category compatibility;
- deterministic source and intent agreement;
- element type sequence;
- normalized layout tokens;
- style tokens;
- size similarity;
- a numeric feature vector compared with cosine similarity;
- light text-token overlap;
- image identity checks for image assets.

The feature vector includes geometry, element-type ratios, slot counts, text/visual balance, quality score, font signals, category, and candidate source. This gives clustering a little more statistical shape awareness without letting it invent elements or coordinates.

Clusters get a boosted score when the pattern repeats across candidates or slides. This is why repeated navigation pills, title lockups, stat cards, and media cards usually float to the top.

### 5. Curation Input

`buildCurationInput()` converts clusters into compact summaries for the AI:

```ts
{
  deckTitle: string;
  slideCount: number;
  clusters: [
    {
      id: string;
      representativeCandidateId: string;
      label: string;
      description: string;
      categoryHint: DesignElementCategory;
      editableSlots: DesignElementSlot[];
      intentHint: DesignElementIntent;
      qualityIssues: string[];
      qualityScore: number;
      qualitySignals: string[];
      recommendedStructure: "group" | "container" | "flex" | "grid";
      score: number;
      occurrenceCount: number;
      slideNumbers: number[];
      bounds: { x: number; y: number; w: number; h: number };
      elements: Array<{
        type: string;
        role: string;
        bounds: { x: number; y: number; w: number; h: number };
        style: string[];
        text?: string;
      }>;
    }
  ];
}
```

This payload is intentionally small. It gives the AI enough semantic context to curate, but not enough freedom to invent a new design.

The newer intent and quality fields help the AI curate for usefulness instead of raw clustering. For example:

- `intentHint` says what the block is likely for, such as `author-pill`, `insight-grid`, `metric-card`, or `title-lockup`.
- `editableSlots` names the meaningful editable parts, such as title, body, metric, date, image, icon, table, chart, or accent.
- `qualityScore` ranks whether the candidate is complete, reusable, and visually distinctive.
- `qualitySignals` and `qualityIssues` explain why a candidate should be promoted or demoted.

## AI Curation

`curateDesignElementsWithAi()` is a TanStack `createServerFn`, so it runs on the server.

Behavior:

- Empty input returns `{ decisions: [], source: "empty" }`.
- `DESIGN_ELEMENT_AI=0` disables AI and returns `{ source: "disabled" }`.
- The model is selected from `DESIGN_ELEMENT_MODEL`, then `OPENAI_MODEL`, then defaults to `gpt-4.1-mini`.
- The call has a 15 second timeout.
- Dynamic imports keep `@tanstack/ai` and `@tanstack/ai-openai` server-side.
- Output is validated by `DesignElementCurationModelOutputSchema`.
- Any failure returns `{ decisions: [], source: "fallback", message }`.

The AI returns decisions like:

```ts
{
  clusterId: string;
  action: "keep" | "drop";
  category: DesignElementCategory;
  label: string;
  description: string;
  intent?: DesignElementIntent | null;
  representativeCandidateId?: string;
  structure?: "group" | "container" | "flex" | "grid" | null;
  confidence: number;
}
```

The prompt asks the model to keep reusable design language and drop one-off or redundant fragments. The AI can choose a better label, description, representative candidate, and structure, but must use existing cluster and candidate IDs.

## Turning Decisions Into Templates

`templatesFromDesignElementCuration()` applies AI decisions.

Rules:

- Only `keep` decisions are used.
- Confidence must be at least `0.35`.
- Kept clusters are sorted by confidence, then cluster score.
- Dropped clusters are not used as fallback.
- If fewer than the limit are kept, deterministic clusters fill the remaining slots.

`templateElementsForCandidate()` then creates the insertable element(s):

- single image assets stay as image elements;
- multi-element candidates become a semantic `container`, `flex`, `grid`, or `group`;
- child elements are converted from slide coordinates to coordinates relative to the semantic wrapper;
- template metadata is stamped with `componentId` and `componentDescription`;
- old imported instance metadata is removed.

## Structure Selection

The deterministic recommendation comes from `recommendedStructureForCandidate()`.

Order of preference:

1. `container` if there is a strong rectangle shell around the block.
2. `grid` if elements form clear x/y bands.
3. `flex` for compact navigation, badge, CTA, or title-lockup row/column systems.
4. `group` as the safe fallback.

The AI may request a structure, but `resolveTemplateStructure()` only accepts that request when the candidate really matches the structure. This keeps bad AI guesses from breaking layout. Flex is accepted for any clearly row/column-like candidate; grid is accepted when the candidate has repeated populated row and column bands.

## Category Hints

Categories are defined by `DesignElementCategorySchema`:

- `navigation`
- `badge`
- `title-lockup`
- `content-card`
- `media-card`
- `stat-card`
- `cta`
- `image-asset`
- `divider`
- `decorative`
- `unknown`

`classifyElements()` assigns the initial category using simple signals:

- image-only candidate -> `image-asset`;
- very thin shape -> `divider`;
- numeric/stat text -> `stat-card`;
- compact horizontal text + shape -> `navigation` or `badge`;
- image + text -> `media-card`;
- heading text -> `title-lockup`;
- text + shape -> `content-card`;
- small shape-only groups -> `decorative`.

The category affects clustering, display labels, and score bonuses.

## Intent And Slot Hints

Intent hints are more specific than categories. A category might say `content-card`, while the intent can say what kind of component the user would insert.

Examples:

| Intent | Meaning |
| --- | --- |
| `author-pill` | Avatar/name/date attribution block. |
| `navigation-pill` | Compact navigation or section label pill. |
| `title-lockup` | Heading plus accent line/shape/subtitle. |
| `insight-grid` | Repeated rows and columns of insights or learnings. |
| `feature-list` | Repeated feature rows, usually title/body/icon. |
| `icon-label-row` | A compact row with icon plus label/body. |
| `metric-card` / `stat-card` | Numeric/stat-focused reusable card. |
| `media-card` | Image plus text/card treatment. |
| `cta-button` | Button-like call to action. |

Slots are the editable parts of the component. They do not change geometry by themselves, but they tell the editor and AI what the component is made of:

- `title`
- `body`
- `label`
- `metric`
- `date`
- `image`
- `icon`
- `list`
- `chart`
- `table`
- `shape`
- `accent`

The drawer can show the intent, slot count, and quality score so users can quickly tell whether a component is useful before inserting it.

## Important Limits

| Constant | Meaning |
| --- | --- |
| `MAX_TEMPLATES = 32` | Max templates returned to the editor. |
| `MAX_ELEMENTS_PER_TEMPLATE = 12` | Caps candidate size so previews and insertion stay manageable. |
| `MAX_LLM_CLUSTERS = 60` | Max clusters sent to the AI. |
| `MIN_GROUP_AREA` | Prevents tiny fragments from becoming blocks. |
| `MAX_GROUP_AREA` | Prevents full-slide sections/backgrounds from becoming blocks. |

## How To Change It Safely

### Add a new candidate source

1. Add a function that returns `Candidate[]`.
2. Add its source name to `Candidate["source"]`.
3. Include it in the raw candidate array inside `createDesignElementExtraction()`.
4. Give every candidate a stable `key`, useful `label`, `description`, `categoryHint`, `score`, and `signature`.
5. Make sure candidates use real existing elements, not generated geometry.

### Add a new category

1. Add it to `DesignElementCategorySchema`.
2. Update `classifyElements()`.
3. Update `categoryDisplayName()`.
4. Update `categoryScoreBonus()` if it should be promoted or demoted.
5. Update the AI prompt in `design-element-curation-ai.ts` if the model should know when to keep it.

### Tune duplicate behavior

Look at:

- `pruneOverlappingCandidates()` for same-slide redundancy;
- `candidateSimilarity()` for cross-slide clustering;
- `layoutTokens()` and `styleTokens()` for what "similar" means;
- `clusterScore()` and `categoryScoreBonus()` for ranking.

### Tune semantic output

Look at:

- `recommendedStructureForCandidate()`;
- `resolveTemplateStructure()`;
- `containerTemplateElement()`;
- `flexTemplateElement()`;
- `gridTemplateElement()`;
- `groupTemplateElement()`;
- `relativeElements()`.

These functions decide whether insertion preserves a card, row/column system, grid, or exact freeform group.

## Debug Checklist

When the drawer shows bad design elements:

1. Check the import status message. It includes candidate and cluster counts.
2. Inspect `extraction.metrics`.
3. Inspect `extraction.candidates` to see whether the raw block was found.
4. Inspect `extraction.clusters` to see whether it was merged with the wrong thing.
5. Inspect `extraction.curationInput` to see what the AI saw.
6. Check `curation.source`; if it is `fallback`, `disabled`, or `empty`, the AI was not used.
7. Check the final `componentTemplates` to see the actual inserted semantic elements.

When preview and insertion differ, debug the semantic renderer/insertion path, not the extractor. Extraction returns schema elements; preview and insertion must render the same element tree.

## Next-Level Roadmap

The current pipeline is deterministic-first: it extracts real elements, scores them, clusters them, and lets AI curate without inventing geometry. That is safe, but not perfect. The next level is to turn extraction into a component-understanding pipeline.

### 1. Visual-Aware Curation

The AI should see images, not only JSON. For each candidate, generate:

- a candidate thumbnail;
- a full-slide thumbnail;
- a full-slide thumbnail with the candidate highlighted.

Then ask the model:

- is this visually complete?
- is it reusable or just a fragment?
- are nearby elements missing?
- should it merge with another candidate?
- is the structure correct: `container`, `group`, `grid`, or `flex`?
- what slots should be editable?

This is the biggest quality jump because the model can spot missing icons, clipped frames, orphaned text, and incomplete cards.

### 2. Candidate Expansion And Repair

This is partially implemented by `repairCandidates()`. Next, make the repair pass more layout-aware:

- grids should group each repeated cell correctly;
- repeated flex rows should detect row ownership before scoring;
- pills should verify frame, icon, and text together;
- incomplete blocks should search nearby elements using row/column ownership;
- repaired candidates should carry an explicit repair confidence.

This reduces fragments before the AI ever sees them.

### 3. Component Reconstruction

Instead of preserving every imported PPTX atom as-is, compile common patterns into cleaner semantic components.

Examples:

- author pill: `container` -> `flex row` -> avatar group + text stack;
- insight grid: `grid` -> grouped cells -> title/body slots per cell;
- feature list: `flex column` -> repeated icon/title/body rows;
- title lockup: group or flex stack with heading, accent, subtitle;
- metric card: container with metric, label, supporting note, accent.

This makes inserted design elements easier to edit and more resilient than raw imported geometry.

### 4. Slot-Based Editing

Slots should become first-class editor controls. Instead of double-clicking nested shapes one by one, selecting a design element could show fields such as:

- Title
- Subtitle
- Metric
- Date
- Image
- Icon

Changing a field would update the correct nested element. This would make extracted components feel like real templates.

### 5. Deduplication By Intent

Deduplication should compare purpose, not only geometry:

- do these components serve the same intent?
- is one a fuller version of the other?
- is one a fragment of a better component?
- should the drawer keep only the highest-quality representative?

The goal is 8-15 excellent design elements, not 30 okay ones.

### 6. Design System Extraction

Extract deck-level design system signals:

- colors;
- fonts;
- corner radii;
- shadows;
- icon treatments;
- divider styles;
- spacing scale;
- recurring layout patterns.

Use these signals to normalize component reconstruction and keep inserted elements visually consistent with the imported deck.

### 7. Preview Fidelity Gate

For each design element:

1. render the drawer preview;
2. insert it into a blank slide;
3. render the inserted version;
4. compare bounds, structure, and pixels.

Penalize or reject components where preview and insertion do not match. This catches many regressions early.

### Recommended Build Order

1. Add deterministic candidate repair/expansion.
2. Add slot-based editing in the drawer.
3. Add thumbnail generation and multimodal AI curation.
4. Add semantic reconstruction for the most common intents.
5. Add preview-vs-inserted quality gates.

The biggest unlock is visual-aware curation plus reconstruction. Without screenshots, the model is inferring from geometry. With screenshots, it can tell when a block is incomplete, overly broad, or genuinely reusable.
